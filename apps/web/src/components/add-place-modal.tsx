'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link as LinkIcon } from 'lucide-react';
import { cn } from '@kebi-app/ui';
import { Illustration } from '@/components/illustrations/Illustration';

type AddPlaceStep = 'input' | 'processing' | 'success';

interface AddPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

export function AddPlaceModal({ isOpen, onClose, onSubmit }: AddPlaceModalProps) {
  const t = useTranslations();
  const [step, setStep] = useState<AddPlaceStep>('input');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!url.trim()) {
      setError(t('addPlace.errors.urlRequired'));
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      setError(t('addPlace.errors.invalidUrl'));
      return;
    }

    setError('');
    setStep('processing');

    // Simulate processing
    setTimeout(() => {
      setStep('success');
      onSubmit(url);
    }, 2000);

    // Reset after success
    setTimeout(() => {
      setStep('input');
      setUrl('');
      onClose();
    }, 3500);
  };

  const handleClose = () => {
    if (step === 'input') {
      setUrl('');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="pointer-events-auto mx-4 w-full max-w-md rounded-2xl bg-card shadow-lg border border-border">
              <div className="relative overflow-hidden">
                <AnimatePresence mode="wait">
                  {step === 'input' && (
                    <motion.div
                      key="input"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                      className="p-6"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h2 className="font-display text-xl text-foreground">
                            {t('addPlace.title')}
                          </h2>
                          <p className="font-body text-xs text-muted-foreground mt-1">
                            {t('addPlace.subtitle')}
                          </p>
                        </div>
                        <button
                          onClick={handleClose}
                          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                      </div>

                      {/* Input */}
                      <div className="space-y-3">
                        <div className="relative">
                          <LinkIcon className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                          <input
                            type="url"
                            placeholder={t('addPlace.placeholder')}
                            value={url}
                            onChange={(e) => {
                              setUrl(e.target.value);
                              setError('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSubmit();
                              }
                            }}
                            className="w-full pl-9 pr-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>

                        {error && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-xs text-destructive"
                          >
                            {error}
                          </motion.p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-6">
                        <button
                          onClick={handleClose}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-border text-foreground font-body text-sm hover:bg-muted transition-colors"
                        >
                          {t('addPlace.cancel')}
                        </button>
                        <button
                          onClick={handleSubmit}
                          disabled={!url.trim()}
                          className={cn(
                            'flex-1 px-4 py-2.5 rounded-xl font-body text-sm transition-all',
                            url.trim()
                              ? 'bg-primary text-primary-foreground hover:shadow-md'
                              : 'bg-muted text-muted-foreground cursor-not-allowed'
                          )}
                        >
                          {t('addPlace.save')}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {step === 'processing' && (
                    <motion.div
                      key="processing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-8 flex flex-col items-center justify-center text-center"
                    >
                      <div className="w-20 h-20 mb-4">
                        <Illustration id="add-place-processing" />
                      </div>
                      <h3 className="font-display text-lg text-foreground mb-1">
                        {t('addPlace.processing')}
                      </h3>
                      <p className="font-body text-xs text-muted-foreground">
                        {t('addPlace.extracting')}
                      </p>
                    </motion.div>
                  )}

                  {step === 'success' && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-8 flex flex-col items-center justify-center text-center"
                    >
                      <motion.div
                        className="w-20 h-20 mb-4"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.6, ease: 'easeInOut' }}
                      >
                        <Illustration id="add-place-success" />
                      </motion.div>
                      <h3 className="font-display text-lg text-foreground mb-1">
                        {t('addPlace.success')}
                      </h3>
                      <p className="font-body text-xs text-muted-foreground">
                        {t('addPlace.successDesc')}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
