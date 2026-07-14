import type { Boat } from '../../types/booking'
import { isFacility } from '../../utils/facility'
import { designSystem, getBookingChoiceStyle, getFontSize, getLabelStyle } from '../../styles/designSystem'

interface BoatSelectorProps {
    boats: Pick<Boat, 'id' | 'name' | 'color'>[]
    selectedBoatId: number
    onSelect: (boatId: number) => void
}

export function BoatSelector({ boats, selectedBoatId, onSelect }: BoatSelectorProps) {
    const safeBoats = boats || []
    
    return (
        <div style={{ marginBottom: designSystem.spacing.lg }}>
            <label style={{ ...getLabelStyle(true), fontWeight: '600' }}>
                船隻
            </label>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: designSystem.spacing.sm,
            }}>
                {safeBoats.map((boat, index) => {
                    const isSelected = selectedBoatId === boat.id
                    const isFirstFacility = isFacility(boat.name) && index === safeBoats.findIndex(b => isFacility(b.name))
                    return (
                        <button
                            key={boat.id}
                            type="button"
                            onClick={() => onSelect(boat.id)}
                            style={{
                                ...getBookingChoiceStyle(isSelected),
                                padding: '14px 8px',
                                fontSize: getFontSize('body', true),
                                fontWeight: isSelected ? '600' : '500',
                                cursor: 'pointer',
                                minHeight: '48px',
                                touchAction: 'manipulation',
                                gridColumn: isFirstFacility ? '1 / span 1' : undefined,
                            }}
                        >
                            {boat.name}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
