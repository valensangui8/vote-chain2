"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Circle, XCircle, AlertCircle } from "lucide-react";

export type TransactionStep = {
  id: string;
  label: string;
  status: "pending" | "processing" | "completed" | "error";
  txHash?: string;
  error?: string;
};

type TransactionProgressModalProps = {
  isOpen: boolean;
  steps: TransactionStep[];
  title?: string;
  onClose?: () => void;
  canClose?: boolean;
};

export function TransactionProgressModal({
  isOpen,
  steps,
  title = "Processing Transaction",
  onClose,
  canClose = false,
}: TransactionProgressModalProps) {
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const totalSteps = steps.length;
  const progress = (completedSteps / totalSteps) * 100;
  const hasError = steps.some((s) => s.status === "error");
  const allCompleted = completedSteps === totalSteps && !hasError;

  const currentStep = steps.find((s) => s.status === "processing");

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => canClose && onClose?.()}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md mx-4"
          >
            <div className="glass rounded-2xl border border-white/10 p-6 shadow-2xl">
              {/* Header */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400">
                  {allCompleted
                    ? "All transactions completed successfully!"
                    : hasError
                    ? "An error occurred during processing"
                    : currentStep
                    ? currentStep.label
                    : "Waiting to begin..."}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>
                    Step {completedSteps} of {totalSteps}
                  </span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      hasError
                        ? "bg-red-500"
                        : allCompleted
                        ? "bg-green-500"
                        : "bg-indigo-500"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Steps List */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {steps.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      step.status === "completed"
                        ? "border-green-500/20 bg-green-500/5"
                        : step.status === "processing"
                        ? "border-indigo-500/50 bg-indigo-500/10"
                        : step.status === "error"
                        ? "border-red-500/20 bg-red-500/5"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    {/* Status Icon */}
                    <div className="mt-0.5">
                      {step.status === "completed" && (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      )}
                      {step.status === "processing" && (
                        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                      )}
                      {step.status === "error" && (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      {step.status === "pending" && (
                        <Circle className="w-5 h-5 text-slate-500" />
                      )}
                    </div>

                    {/* Step Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          step.status === "completed"
                            ? "text-green-300"
                            : step.status === "processing"
                            ? "text-indigo-300"
                            : step.status === "error"
                            ? "text-red-300"
                            : "text-slate-400"
                        }`}
                      >
                        {step.label}
                      </p>
                      {step.error && (
                        <p className="text-xs text-red-400 mt-1">{step.error}</p>
                      )}
                      {step.txHash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${step.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-block"
                        >
                          View on Etherscan →
                        </a>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Action Buttons */}
              {(allCompleted || hasError || canClose) && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  {hasError && (
                    <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-200">
                        Some transactions failed. You may need to retry or contact support.
                      </p>
                    </div>
                  )}
                  <button
                    onClick={onClose}
                    className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition ${
                      allCompleted
                        ? "bg-green-600 hover:bg-green-500 text-white"
                        : hasError
                        ? "bg-red-600 hover:bg-red-500 text-white"
                        : "bg-white/10 hover:bg-white/20 text-white"
                    }`}
                  >
                    {allCompleted ? "Done ✓" : hasError ? "Close" : "Cancel"}
                  </button>
                </div>
              )}

              {/* Processing message */}
              {!allCompleted && !hasError && !canClose && (
                <div className="mt-4 text-center">
                  <p className="text-xs text-slate-500">
                    Please don't close this window...
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
