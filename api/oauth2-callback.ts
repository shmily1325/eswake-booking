import { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

/**
 * OAuth 2.0 回調端點
 * 用於處理 Google OAuth 授權回調，並取得刷新令牌
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, error } = req.query;

  // 檢查是否有錯誤
  if (error) {
    return res.status(400).json({
      error: '授權失敗',
      message: error,
    });
  }

  // 檢查是否有授權碼
  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      error: '缺少授權碼',
      message: '請確保您已授權應用程式存取 Google Drive',
    });
  }

  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 
      `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/oauth2-callback`;

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        error: 'OAuth 憑證未設定',
        message: '請在 Vercel 環境變數中設定 GOOGLE_OAUTH_CLIENT_ID 和 GOOGLE_OAUTH_CLIENT_SECRET',
      });
    }

    // 建立 OAuth 2.0 客戶端
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // 交換授權碼取得令牌
    const { tokens } = await oauth2Client.getToken(code);

    // 返回結果
    return res.status(200).json({
      success: true,
      message: '✅ 成功取得刷新令牌！',
      tokens: {
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        expiry_date: tokens.expiry_date,
      },
      instructions: {
        step1: '請將以下刷新令牌複製到 Vercel 環境變數：',
        step2: '變數名稱：GOOGLE_OAUTH_REFRESH_TOKEN',
        step3: '變數值：' + tokens.refresh_token,
        step4: '更新環境變數後重新部署',
        note: '⚠️ 刷新令牌只會顯示一次，請妥善保存！',
      },
    });
  } catch (error: any) {
    console.error('OAuth 回調錯誤:', error);
    return res.status(500).json({
      error: '取得令牌失敗',
      message: error.message || 'Unknown error',
    });
  }
}

