import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

const NetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);

        window.addEventListener("online", goOnline);
        window.addEventListener("offline", goOffline);

        return () => {
            window.removeEventListener("online", goOnline);
            window.removeEventListener("offline", goOffline);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className="fixed top-0 left-0 w-full z-[9999] animate-in slide-in-from-top duration-300">
            <div className="bg-destructive text-destructive-foreground px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider shadow-md">
                <WifiOff className="w-3.5 h-3.5" />
                <span>⚠️ You are offline. Some features may not work.</span>
            </div>
        </div>
    );
};

export default NetworkStatus;
