import type { Boat } from '../../types/booking'

interface BoatSelectorProps {
    boats: Pick<Boat, 'id' | 'name' | 'color'>[]
    selectedBoatId: number
    onSelect: (boatId: number) => void
}

export function BoatSelector({ boats, selectedBoatId, onSelect }: BoatSelectorProps) {
    console.log('[BoatSelector] Rendering, boats:', boats?.length)
    const safeBoats = boats || []
    
    return (
        <div style={{ marginBottom: '18px' }}>
            <label style={{
                display: 'block',
                marginBottom: '10px',
                color: '#000',
                fontSize: '15px',
                fontWeight: '600',
            }}>
                船隻
            </label>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
            }}>
                {safeBoats.map(boat => {
                    const isSelected = selectedBoatId === boat.id
                    return (
                        <button
                            key={boat.id}
                            type="button"
                            onClick={() => onSelect(boat.id)}
                            style={{
                                padding: '14px 8px',
                                border: isSelected ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                                borderRadius: '8px',
                                background: isSelected ? '#dbeafe' : 'white',
                                color: '#333',
                                fontSize: '15px',
                                fontWeight: isSelected ? '600' : '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onTouchStart={(e) => {
                                e.currentTarget.style.background = isSelected ? '#dbeafe' : '#fafafa'
                            }}
                            onTouchEnd={(e) => {
                                e.currentTarget.style.background = isSelected ? '#dbeafe' : 'white'
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
