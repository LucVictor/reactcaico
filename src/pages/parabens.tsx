import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Rocket, Trophy, Crown, X, Medal } from "lucide-react";
import confetti from "canvas-confetti";

interface CongratsProps {
  position: number;
  fullMessage?: string; // ← nova prop
  username?: string; // opcional, se quiser forçar
  onClose: () => void | Promise<void>;
}
export default function CongratsRank({
  position,
  username,
  fullMessage,

  onClose,
}: CongratsProps) {
  const [visible, setVisible] = useState(false);
  const hasFiredConfetti = useRef(false);

  const rankInfo = {
    1: {
      label: "1º Lugar",
      medal: "🥇",
      icon: <Crown className="h-9 w-9 text-yellow-300" />,
      bg: "from-yellow-600/95 via-amber-500 to-orange-700/95",
      border: "border-yellow-400/80",
      glow: "rgba(251, 191, 36, 0.7)",
      confettiColors: ["#fbbf24", "#f59e0b", "#fcd34d", "#ffffff", "#fef3c7"],
    },
    2: {
      label: "2º Lugar",
      medal: "🥈",
      icon: <Medal className="h-9 w-9 text-gray-300" />,
      bg: "from-gray-600 via-gray-500 to-slate-700",
      border: "border-gray-400/70",
      glow: "rgba(156, 163, 175, 0.6)",
      confettiColors: ["#94a3b8", "#cbd5e1", "#e2e8f0", "#ffffff"],
    },
    3: {
      label: "3º Lugar",
      medal: "🥉",
      icon: <Medal className="h-9 w-9 text-orange-600" />,
      bg: "from-orange-700 via-amber-800 to-yellow-900",
      border: "border-orange-600/70",
      glow: "rgba(180, 83, 9, 0.6)",
      confettiColors: ["#ea580c", "#dc2626", "#f97316", "#ffffff"],
    },
    default: {
      label: `${position}º Lugar`,
      medal: null,
      icon: <Rocket className="h-12 w-12 text-yellow-400" />,
      bg: "from-gray-800 via-gray-900 to-black",
      border: "border-gray-600",
      glow: "rgba(0,0,0,0.4)",
      confettiColors: ["#60a5fa", "#93c5fd", "#dbeafe", "#ffffff"],
    },
  };

  const info =
    position === 1
      ? rankInfo[1]
      : position === 2
        ? rankInfo[2]
        : position === 3
          ? rankInfo[3]
          : rankInfo.default;
  const isPodium = position <= 3;

  // Animação de entrada
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(timer);
  }, []);

  // Confetes personalizados por posição
  useEffect(() => {
    if (visible && !hasFiredConfetti.current) {
      hasFiredConfetti.current = true;

      const count =
        position === 1 ? 180 : position === 2 ? 120 : position === 3 ? 100 : 60;
      const defaults = { origin: { y: 0.6 }, zIndex: 9999 };

      // Explosão principal
      confetti({
        ...defaults,
        particleCount: count,
        spread: position === 1 ? 80 : 70,
        colors: info.confettiColors,
      });

      // Chuva contínua por 4 segundos
      const duration = 4000;
      const end = Date.now() + duration;

      const interval = setInterval(() => {
        if (Date.now() > end) return clearInterval(interval);

        confetti({
          ...defaults,
          particleCount: position === 1 ? 30 : 15,
          angle: Math.random() * 360,
          spread: 50 + Math.random() * 50,
          origin: { x: Math.random(), y: Math.random() * 0.3 },
          colors: info.confettiColors,
        });
      }, 300);
    }
  }, [visible, position, info.confettiColors]);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pointer-events-none fixed inset-0 z-[9999] flex items-start justify-center pt-20"
    >
      <motion.div
        initial={{ scale: 0.4, y: -100, rotate: -10 }}
        animate={{ scale: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.7, ease: "backOut" }}
        className="pointer-events-auto"
      >
        <div
          className={`relative m-9 overflow-hidden rounded-3xl border-2 bg-gradient-to-br p-8 text-white shadow-2xl backdrop-blur-2xl ${info.bg} ${info.border}`}
          style={{
            boxShadow: `0 0 50px ${info.glow}, inset 0 0 40px rgba(255,255,255,0.15)`,
          }}
        >
          {/* Botão fechar */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full bg-white/20 p-2.5 backdrop-blur-sm transition hover:scale-110 hover:bg-white/30"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-6">
            {/* Ícone principal com animação */}
            <motion.div
              animate={{ y: isPodium ? [-10, -30, -10] : [-6, 6, -6] }}
              transition={{
                repeat: Infinity,
                duration: isPodium ? 2 : 2.5,
                ease: "easeInOut",
              }}
            >
              {isPodium ? (
                info.icon
              ) : (
                <Rocket className="h-14 w-14 text-yellow-400" />
              )}
            </motion.div>

            <div className="flex-1">
              {/* Título com medalha */}
              <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight">
                {info.medal && <span className="text-5xl">{info.medal}</span>}
                Parabéns!
                {position === 1 && (
                  <Crown className="h-10 w-10 animate-pulse text-yellow-200" />
                )}
              </h1>

              <p className="mt-3 text-xl font-medium opacity-95">
                {username ? `${username}, ` : ""}você conquistou o
              </p>

              <p className="mt-1 text-3xl font-black text-white drop-shadow-2xl">
                {info.label}
              </p>

              {/* Mensagens especiais */}
              {position === 1 && (
                <p className="mt-4 flex items-center gap-3 text-yellow-100">
                  <Trophy className="h-7 w-7 animate-bounce" />
                  <span className="text-lg font-bold">{fullMessage}</span>
                  <Trophy className="h-7 w-7 animate-bounce" />
                </p>
              )}
              {position === 2 && (
                <p className="mt-3 text-gray-200">
                  <span className="text-lg font-bold">{fullMessage}</span>
                </p>
              )}
              {position === 3 && (
                <p className="mt-3 text-orange-200">
                  <span className="text-lg font-bold">{fullMessage}</span>
                </p>
              )}
            </div>
          </div>

          {/* Efeito de brilho pulsante (só pódio) */}
          {isPodium && (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-3xl border-4 border-white/30"
              animate={{ opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
          )}

          {/* Estrelinhas caindo (só para 1º e 2º) */}
          {position <= 2 &&
            [...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-2xl"
                initial={{ y: -50, x: `${10 + i * 10}%`, opacity: 0 }}
                animate={{ y: 400, opacity: [0, 1, 0] }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  delay: i * 0.4,
                  ease: "linear",
                }}
              >
                {position === 1 ? "✨" : "⭐"}
              </motion.div>
            ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
