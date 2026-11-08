import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Smartphone, Wifi } from 'lucide-react'
import { Button } from '@common/components/Button'
import { cn } from '@common/lib/utils'

type Pairing = Awaited<ReturnType<typeof window.sidebarAPI.companion.getPairing>>
type Device = Pairing['devices'][number]

// "Connect your phone": the QR code the Blueberry app scans, plus live status
// of connected phones. Opened from the phone button in the toolbar.
export const CompanionPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [pairing, setPairing] = useState<Pairing | null>(null)
    const [devices, setDevices] = useState<Device[]>([])
    const [justConnected, setJustConnected] = useState<string | null>(null)
    const knownDevices = useRef(0)

    const load = useCallback(async () => {
        const info = await window.sidebarAPI.companion.getPairing()
        setPairing(info)
        setDevices(info.devices)
        knownDevices.current = info.devices.length
    }, [])

    useEffect(() => {
        void load()
        return window.sidebarAPI.companion.onDevicesChanged((next) => {
            // Celebrate a phone that connects while the code is on screen
            if (next.length > knownDevices.current) {
                setJustConnected(next[next.length - 1].name)
            }
            knownDevices.current = next.length
            setDevices(next)
        })
    }, [load])

    useEffect(() => {
        if (!justConnected) return
        const timer = setTimeout(() => setJustConnected(null), 4000)
        return () => clearTimeout(timer)
    }, [justConnected])

    const resetPairing = async (): Promise<void> => {
        const ok = window.confirm(
            'Reset the pairing code? Phones that are connected now will be disconnected and need to scan the new code.'
        )
        if (!ok) return
        const info = await window.sidebarAPI.companion.resetPairing()
        setPairing(info)
    }

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="h-8 px-4 flex items-center">
                <Button variant="ghost" size="sm" onClick={onClose}>
                    <ArrowLeft className="size-4" />
                    Back to chat
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-semibold text-foreground">Connect your phone</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Open the Blueberry app on your phone and choose{' '}
                        <span className="text-foreground font-medium">Link with QR code</span>. Hand off
                        tasks, watch them run and approve steps from anywhere in the house.
                    </p>
                </div>

                <div className="relative self-center">
                    {/* Always on white: phone cameras read dark-on-light codes most reliably */}
                    <div className="bg-white rounded-2xl p-4 shadow-subtle border border-border">
                        {pairing ? (
                            <img src={pairing.qrDataUrl} alt="Pairing QR code" className="size-56" />
                        ) : (
                            <div className="size-56 animate-pulse rounded-lg bg-neutral-100" />
                        )}
                    </div>
                    {justConnected && (
                        <div className="absolute inset-0 rounded-2xl bg-background/95 flex flex-col items-center justify-center gap-2 animate-fade-in">
                            <CheckCircle2 className="size-12 text-green-500" />
                            <p className="text-sm font-medium text-foreground">Connected</p>
                            <p className="text-xs text-muted-foreground">{justConnected}</p>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground self-center">
                    <Wifi className="size-3.5" />
                    Your phone and {pairing?.desktopName ?? 'this computer'} need to be on the same Wi-Fi.
                </div>

                <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Phones
                    </h3>
                    {devices.length === 0 ? (
                        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3">
                            <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-sm text-muted-foreground">Waiting for your phone…</span>
                        </div>
                    ) : (
                        devices.map((device) => (
                            <div
                                key={`${device.name}-${device.connectedAt}`}
                                className={cn(
                                    'flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3',
                                    'dark:bg-muted/40'
                                )}
                            >
                                <Smartphone className="size-4 text-muted-foreground" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-foreground truncate">{device.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Connected since{' '}
                                        {new Date(device.connectedAt).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                                <span className="size-2 rounded-full bg-green-500" />
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="px-6 py-4 border-t border-border">
                <Button variant="link" size="sm" className="px-0 text-muted-foreground" onClick={resetPairing}>
                    Reset pairing code
                </Button>
            </div>
        </div>
    )
}
