import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bike, Search, Menu, User, MapPin } from "lucide-react";

interface LoadingScreenProps {
  username?: string;
  onFinished: () => void;
}

const loadingMessages = [
  "Initializing...",
  "Loading your profile...",
  "Fetching nearby rides...",
  "Preparing dashboard...",
  "Almost ready..."
];

export function LoadingScreen({ username, onFinished }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const totalDuration = 3000;
    const interval = 50; 
    const steps = totalDuration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const newProgress = Math.min(100, Math.floor((currentStep / steps) * 100));
      setProgress(newProgress);

      if (currentStep >= steps) {
        clearInterval(timer);
        setExiting(true);
        setTimeout(() => {
          onFinished();
        }, 400); // 400ms seamless exit transition
      }
    }, interval);

    return () => clearInterval(timer);
  }, [onFinished]);

  useEffect(() => {
    // Switch messages every 500ms
    const msgTimer = setInterval(() => {
      setMessageIndex((prev) => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
    }, 500);
    return () => clearInterval(msgTimer);
  }, []);

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          key="loading-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #FFFFFF 0%, #F8FBFF 50%, #EEF6FF 100%)"
          }}
        >
          {/* Background Dashboard Skeleton Preview */}
          <motion.div 
            className="absolute inset-0 pointer-events-none opacity-[0.12] blur-[3px]"
            animate={{ 
              filter: progress === 100 ? "blur(0px)" : "blur(3px)",
              opacity: progress === 100 ? 0.3 : 0.12
            }}
            transition={{ duration: 0.4 }}
          >
            <div className="max-w-md mx-auto w-full h-full p-6 flex flex-col gap-6 pt-12">
              <div className="flex justify-between items-center">
                <div className="w-10 h-10 rounded-full bg-slate-400" />
                <div className="w-32 h-6 rounded-md bg-slate-400" />
                <div className="w-10 h-10 rounded-full bg-slate-400" />
              </div>
              <div className="w-full h-14 rounded-2xl bg-slate-400 mt-4" />
              <div className="w-full h-40 rounded-3xl bg-slate-400 mt-6" />
              <div className="w-full h-40 rounded-3xl bg-slate-400" />
              <div className="w-full h-40 rounded-3xl bg-slate-400" />
            </div>
          </motion.div>

          {/* Main Loading Content */}
          <div className="relative z-10 w-full max-w-sm px-8 flex flex-col items-center">
            
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ 
                opacity: 1, 
                scale: progress === 100 ? 0.95 : 1 
              }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-4 mb-12"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center shadow-[0_8px_30px_rgba(37,99,235,0.3)]"
                style={{ borderRadius: "20px" }}
              >
                <Bike className="w-8 h-8 text-white" />
              </motion.div>
              <div className="flex flex-col items-center">
                <h1 className="text-3xl font-bold tracking-tight text-slate-800">
                  Dost<span className="text-blue-600">Wheels</span>
                </h1>
                {username && (
                  <motion.h2 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-lg font-medium text-slate-500 mt-1"
                  >
                    Welcome, <span className="text-slate-800">{username}</span>
                  </motion.h2>
                )}
              </div>
            </motion.div>

            {/* Subtle Scooter Route Animation */}
            <div className="w-full relative h-12 mb-6 flex items-center">
              <div className="absolute w-full h-[2px] border-t-[2px] border-dashed border-slate-300" />
              <motion.div
                initial={{ left: "0%" }}
                animate={{ left: "100%" }}
                transition={{ duration: 3, ease: "easeInOut" }}
                className="absolute -ml-4"
              >
                <div className="bg-white p-1.5 rounded-full shadow-sm border border-slate-100 text-blue-600">
                  <MapPin className="w-5 h-5 fill-blue-50" />
                </div>
              </motion.div>
            </div>

            {/* Progress Bar & Text Container */}
            <div className="w-full flex flex-col gap-3">
              {/* Cycling Text & Percentage */}
              <div className="flex justify-between items-end text-sm font-medium text-slate-600 px-1">
                <div className="h-5 relative flex-1 overflow-hidden">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={messageIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="absolute left-0 bottom-0 whitespace-nowrap"
                    >
                      {loadingMessages[messageIndex]}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <span className="font-semibold text-slate-800 tabular-nums">{progress}%</span>
              </div>

              {/* Premium Progress Bar */}
              <div className="w-full h-2 bg-slate-200/60 rounded-full overflow-hidden shadow-inner p-[1px] backdrop-blur-sm">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)] transition-all duration-75 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
