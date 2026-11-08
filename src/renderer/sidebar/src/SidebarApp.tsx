import React, { useEffect, useState } from 'react'
import { ChatProvider } from './contexts/ChatContext'
import { Chat } from './components/Chat'
import { CompanionPanel } from './components/CompanionPanel'
import { useDarkMode } from '@common/hooks/useDarkMode'

const SidebarContent: React.FC = () => {
    const { isDarkMode } = useDarkMode()
    const [showPairing, setShowPairing] = useState(false)

    // Apply dark mode class to the document
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [isDarkMode])

    // The toolbar's phone button asks the sidebar to show the pairing code
    useEffect(() => window.sidebarAPI.companion.onShowPairing(() => setShowPairing(true)), [])

    return (
        <div className="h-screen flex flex-col bg-background border-l border-border">
            {showPairing ? <CompanionPanel onClose={() => setShowPairing(false)} /> : <Chat />}
        </div>
    )
}

export const SidebarApp: React.FC = () => {
    return (
        <ChatProvider>
            <SidebarContent />
        </ChatProvider>
    )
}
