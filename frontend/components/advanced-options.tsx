"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Settings, ChevronDown, Sparkles, Zap, FileText, Palette } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

interface AdvancedOptionsProps {
  options: {
    format: string
    orientation: string
    quality: string
    aiOptimize: boolean
  }
  onChange: (options: any) => void
  disabled?: boolean
}

export function AdvancedOptions({ options, onChange, disabled = false }: AdvancedOptionsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const updateOption = (key: string, value: any) => {
    onChange({ ...options, [key]: value })
  }

  return (
    <Card className="glass border-0 shadow-lg">
      <CardHeader className="pb-3">
        <Button
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={disabled}
          className="w-full justify-between p-0 h-auto hover:bg-transparent"
        >
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Advanced Options</CardTitle>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </Button>
        <CardDescription>
          Customize your PDF generation with AI-powered optimization
        </CardDescription>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <CardContent className="space-y-6 pt-0">
              {/* AI Optimization */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <label className="text-sm font-medium">AI Optimization</label>
                  </div>
                  <Switch
                    checked={options.aiOptimize}
                    onChange={(checked) => updateOption('aiOptimize', checked)}
                    disabled={disabled}
                  />
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Use AI to analyze content, remove ads, and optimize layout for better PDFs
                </p>
              </div>

              {/* Page Format */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <label className="text-sm font-medium">Page Format</label>
                </div>
                <Select
                  value={options.format}
                  onChange={(e) => updateOption('format', e.target.value)}
                  disabled={disabled}
                >
                  <option value="A4">A4 (210 × 297 mm)</option>
                  <option value="Letter">Letter (8.5 × 11 in)</option>
                  <option value="Legal">Legal (8.5 × 14 in)</option>
                  <option value="A3">A3 (297 × 420 mm)</option>
                </Select>
              </div>

              {/* Orientation */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Palette className="w-4 h-4 text-green-500" />
                  <label className="text-sm font-medium">Orientation</label>
                </div>
                <Select
                  value={options.orientation}
                  onChange={(e) => updateOption('orientation', e.target.value)}
                  disabled={disabled}
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </Select>
              </div>

              {/* Quality */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-orange-500" />
                  <label className="text-sm font-medium">Quality</label>
                </div>
                <Select
                  value={options.quality}
                  onChange={(e) => updateOption('quality', e.target.value)}
                  disabled={disabled}
                >
                  <option value="low">Low (Faster, smaller file)</option>
                  <option value="medium">Medium (Balanced)</option>
                  <option value="high">High (Best quality, larger file)</option>
                </Select>
              </div>

              {/* Quality Info */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <h4 className="text-sm font-medium flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>Quality Settings</span>
                </h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Low:</strong> 1024×768 resolution, faster processing</p>
                  <p><strong>Medium:</strong> 1280×1024 resolution, balanced quality</p>
                  <p><strong>High:</strong> 1920×1080 resolution, best quality</p>
                </div>
              </div>

              {options.aiOptimize && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800"
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      AI Features Enabled
                    </span>
                  </div>
                  <ul className="text-xs text-purple-600 dark:text-purple-400 space-y-1">
                    <li>• Smart content analysis and extraction</li>
                    <li>• Automatic ad and popup removal</li>
                    <li>• Intelligent page break suggestions</li>
                    <li>• Enhanced metadata generation</li>
                  </ul>
                </motion.div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}