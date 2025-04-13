'use client';
import { motion } from 'framer-motion';

const Loader = () => {
  // Animation variants for the text
  const textVariants = {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut",
      }
    }
  };

  // Animation variants for the gradient background
  const gradientVariants = {
    animate: {
      backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
      transition: {
        duration: 3,
        ease: "linear",
        repeat: Infinity,
      }
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0a]">
      <motion.div
        initial="hidden"
        animate="visible"
        className="relative flex flex-col items-center"
      >
        {/* Animated text */}
        <motion.div
          variants={textVariants}
          className="text-4xl md:text-6xl font-bold tracking-wider"
        >
          <motion.span
            animate="animate"
            variants={gradientVariants}
            className="inline-block bg-gradient-to-r from-white via-purple-400 to-white bg-clip-text text-transparent bg-[length:200%]"
          >
            LUMIBYTE
          </motion.span>
        </motion.div>

        {/* Subtle loading indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-4 flex items-center gap-2"
        >
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
                className="w-2 h-2 rounded-full bg-purple-500"
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Loader;