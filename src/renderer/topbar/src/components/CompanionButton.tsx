import React, { useEffect, useState } from 'react'
import { Smartphone } from 'lucide-react'
import { ToolBarButton } from './ToolBarButton'

// Opens the "Connect your phone" panel; the dot shows a phone is connected
export const CompanionButton: React.FC = () => {
    const [connected, setConnected] = useState(false)

    useEffect(
        () => window.topBarAPI.onCompanionDevices((devices) => setConnected(devices.length > 0)),
        []
    )

    return (
        <ToolBarButton onClick={() => window.topBarAPI.showCompanionPairing()} className="relative">
            <Smartphone className="size-4.5" />
            {connected && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-green-500 ring-2 ring-background" />
            )}
        </ToolBarButton>
    )
}
