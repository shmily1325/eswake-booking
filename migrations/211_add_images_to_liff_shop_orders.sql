BEGIN;

CREATE OR REPLACE FUNCTION public.get_liff_shop_orders(p_line_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_orders JSONB;
BEGIN
  IF NULLIF(trim(p_line_user_id), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '缺少 LINE 使用者識別');
  END IF;

  SELECT member_id
  INTO v_member_id
  FROM public.line_bindings
  WHERE line_user_id = p_line_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到有效的會員綁定');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'order_no', o.order_no,
        'contact_name', o.contact_name,
        'delivery_method', o.delivery_method,
        'shipping_info', o.shipping_info,
        'customer_note', o.customer_note,
        'cancelled_at', o.cancelled_at,
        'created_at', o.created_at,
        'settlements', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('amount_total', s.amount_total)
            ORDER BY s.settled_at
          )
          FROM public.shop_order_settlements s
          WHERE s.order_id = o.id
        ), '[]'::jsonb),
        'items', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', i.id,
              'qty', i.qty,
              'qty_pending_bill', i.qty_pending_bill,
              'qty_paid', i.qty_paid,
              'unit_price', i.unit_price,
              'variant', CASE
                WHEN v.id IS NULL THEN NULL
                ELSE jsonb_build_object(
                  'id', v.id,
                  'vendor_code', v.vendor_code,
                  'attributes', v.attributes,
                  'last_stock_in_at', v.last_stock_in_at,
                  'stock', v.stock,
                  'reserved_qty', v.reserved_qty,
                  'cover_image_url', v.cover_image_url,
                  'cover_image_path', v.cover_image_path,
                  'cover_images', v.cover_images,
                  'image_url', v.image_url,
                  'product', CASE
                    WHEN product.id IS NULL THEN NULL
                    ELSE jsonb_build_object(
                      'id', product.id,
                      'brand', product.brand,
                      'model', product.model,
                      'model_year', product.model_year,
                      'color', product.color,
                      'category', product.category,
                      'cover_image_url', product.cover_image_url,
                      'cover_image_path', product.cover_image_path,
                      'cover_images', product.cover_images
                    )
                  END
                )
              END
            )
            ORDER BY i.created_at, i.id
          )
          FROM public.shop_order_items i
          LEFT JOIN public.product_variants v ON v.id = i.variant_id
          LEFT JOIN public.products product ON product.id = v.product_id
          WHERE i.order_id = o.id
        ), '[]'::jsonb)
      )
      ORDER BY o.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_orders
  FROM public.shop_orders o
  WHERE o.member_id = v_member_id
    AND o.cancelled_at IS NULL;

  RETURN jsonb_build_object('success', true, 'orders', v_orders);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', '商品訂單服務暫時無法使用');
END;
$$;

REVOKE ALL ON FUNCTION public.get_liff_shop_orders(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_liff_shop_orders(TEXT) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
