'use client';
import { motion } from 'framer-motion';

const Loader = () => {
  const textVariants = {
    animate: {
      opacity: [0, 1, 1, 1, 0],
      transition: {
        opacity: {
          duration: 2.2, // Reduced from 3 to 2.2 seconds
          times: [0, 0.2, 0.5, 0.8, 1], // Adjusted timing
          repeat: Infinity,
          ease: "easeInOut",
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0a]">
      <motion.span
        initial={{ opacity: 0 }}
        animate="animate"
        variants={textVariants}
        className="text-xl sm:text-2xl font-normal tracking-wide text-white"
      >
        Lumibyte
      </motion.span>
    </div>
  );
};

export default Loader;
