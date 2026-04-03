import React from 'react';
import { useOfflineStatus } from '../hooks/useOffline';
import { Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOfflineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium"
        >
          <WifiOff size={16} />
          <span>অফলাইন মোডে আছেন। ডাটা পরে সিঙ্ক হবে।</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
