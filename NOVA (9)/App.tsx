import React, { useState, useEffect, useRef } from 'react';
import { AppState, OSView, ChatMessage, SystemStats } from './types';
import VoiceOrb from './components/VoiceOrb';
import SimulatedOS from './components/SimulatedOS';
import { geminiLiveService } from './services/geminiService';

const MASTER_NAME = "Mr. Khan";

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [appState, setAppState] = useState<AppState>(AppState.LOCKED);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  const appStateRef = useRef(appState);

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    geminiLiveService.onAudioLevel = (level) => {
      setAudioLevel(level);
      if (level > 10 && appState === AppState.AUTHORIZED) {
        setAppState(AppState.SPEAKING);
      } else if (level < 5 && appState === AppState.SPEAKING) {
        setAppState(AppState.AUTHORIZED);
      }
    };
    
    geminiLiveService.onMessage = (text, isUser) => {
      setMessages(prev => {
         const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';
         const newMsgs = [...prev, { id: Date.now().toString(), role, text, timestamp: Date.now() }];
         return newMsgs.slice(-5); // Keep chat very short, like a HUD log
      });
      if (!isUser) setAppState(AppState.AUTHORIZED);
    };
  }, [appState]);

  const initSystem = async () => {
    await geminiLiveService.initializeAudio();
    setIsInitialized(true);
    startWakeWordListener();
  };

  const startWakeWordListener = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onend = () => {
         // Use ref to check current state, avoiding stale closure
         if (appStateRef.current === AppState.LOCKED) {
             try { recognition.start(); } catch(e) {}
         }
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
           interimTranscript += event.results[i][0].transcript;
        }
        const combinedText = interimTranscript.toLowerCase();
        // Use ref to check current state
        if (appStateRef.current === AppState.LOCKED && (combinedText.includes("nova") || combinedText.includes("hello"))) {
           recognition.stop();
           triggerUnlockSequence();
        }
      };
      recognitionRef.current = recognition;
      try { recognition.start(); } catch (e) {}
    } else {
        // Fallback for browsers without Speech Rec
        alert("Browser does not support local wake word. Use button.");
    }
  };

  const triggerUnlockSequence = async () => {
    setAppState(AppState.SCANNING);
    if (recognitionRef.current) recognitionRef.current.stop();

    // Fast simulated handshake
    setTimeout(async () => {
        setAppState(AppState.CONNECTING);
        await geminiLiveService.connect(() => {
            setAppState(AppState.AUTHORIZED);
            setMessages([{ id: 'init', role: 'assistant', text: "Systems Optimized. Quantum Bridge Active.", timestamp: Date.now() }]);
        });
    }, 800);
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden font-rajdhani">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#083344_0%,_#000_70%)] opacity-50"></div>
         <div className="z-10 text-center">
            <h1 className="text-7xl font-orbitron text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-900 tracking-tighter drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">NOVA</h1>
            <div className="mt-4 text-cyan-500 font-mono tracking-[1em] text-xs">SUPERINTELLIGENCE ARCHITECTURE</div>
            
            <button 
              onClick={initSystem}
              className="mt-12 px-10 py-3 bg-transparent border border-cyan-500/30 text-cyan-400 font-bold hover:bg-cyan-500/10 hover:border-cyan-400 transition-all duration-300 tracking-widest clip-path-polygon"
              style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)' }}
            >
               ESTABLISH LINK
            </button>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-cyan-500 font-rajdhani overflow-hidden flex flex-col p-4">
      
      {/* HEADER HUD */}
      <header className="flex justify-between items-end border-b border-cyan-900/30 pb-2 mb-4 relative">
          <div className="absolute bottom-0 left-0 w-32 h-[1px] bg-cyan-400"></div>
          <div>
              <h1 className="text-3xl font-orbitron text-white tracking-wider">NOVA <span className="text-cyan-600 text-sm">2095</span></h1>
              <div className="text-[10px] text-gray-500 font-mono">CONNECTION: {appState === AppState.LOCKED ? 'STANDBY' : 'SECURE'} // {MASTER_NAME.toUpperCase()}</div>
          </div>
          <div className="text-right">
              <div className="text-2xl font-bold text-cyan-400">{new Date().getFullYear() + 70}</div>
              <div className="text-[9px] tracking-widest text-amber-500 animate-pulse">TEMPORAL SYNC: ACTIVE</div>
          </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* LEFT: LOGS */}
        <div className="lg:col-span-4 flex flex-col gap-4">
           <div className="flex-1 bg-black/40 border border-cyan-900/30 rounded-lg p-4 backdrop-blur-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 opacity-30">
                  <i className="fas fa-history text-cyan-500"></i>
               </div>
               <div className="h-full overflow-y-auto space-y-6 custom-scrollbar flex flex-col justify-end">
                   {messages.map(msg => (
                       <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end text-right' : 'items-start'}`}>
                           <span className="text-[9px] text-gray-600 mb-1 font-mono uppercase">{msg.role === 'user' ? MASTER_NAME : 'NOVA'}</span>
                           <span className={`text-sm md:text-base ${msg.role === 'assistant' ? 'text-cyan-100' : 'text-amber-100'} leading-relaxed`}>
                               {msg.text}
                           </span>
                       </div>
                   ))}
               </div>
           </div>
        </div>

        {/* CENTER: ORB & VISUALS */}
        <div className="lg:col-span-4 flex items-center justify-center py-10">
            <VoiceOrb state={appState} audioLevel={audioLevel} />
        </div>

        {/* RIGHT: OS STATUS */}
        <div className="lg:col-span-4 flex flex-col">
            <div className="flex-1 min-h-[300px]">
                <SimulatedOS currentView={OSView.NEXUS} systemStats={{ cpu: 99, quantumStability: 100, networkLat: 0, encryptionLevel: 'MAX' }} isAuthorized={appState !== AppState.LOCKED} />
            </div>
            
            {/* MANUAL CONTROLS */}
            {appState === AppState.LOCKED && (
                <button 
                    onClick={triggerUnlockSequence} 
                    className="mt-4 w-full py-4 border border-cyan-800 text-cyan-600 hover:bg-cyan-900/20 hover:text-cyan-300 transition-all font-mono text-xs uppercase tracking-widest"
                >
                    Manual Override: Initialize
                </button>
            )}
        </div>
      </main>

      {/* FOOTER DECORATION */}
      <div className="mt-4 flex justify-between opacity-30 text-[8px] font-mono">
          <div>MEM: 4096 TB</div>
          <div>CPU: QUANTUM CORE X9</div>
          <div>LOC: EARTH.2025</div>
      </div>
    </div>
  );
}

export default App;