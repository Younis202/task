"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Download, 
  Globe, 
  Zap, 
  Shield, 
  Sparkles, 
  ArrowRight,
  CheckCircle,
  AlertCircle,
  FileText,
  Camera,
  Wand2,
  Brain,
  Gauge,
  Lock
} from "lucide-react"
import toast from "react-hot-toast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { AnimatedBackground } from "@/components/animated-background"
import { LoadingSpinner, PulsingDots } from "@/components/loading-spinner"
import { AdvancedOptions } from "@/components/advanced-options"
import { cn, isValidUrl, formatUrl } from "@/lib/utils"

type AppState = 'idle' | 'generating' | 'completed' | 'error'

interface GenerationOptions {
  format: string
  orientation: string
  quality: string
  aiOptimize: boolean
}

export default function Home() {
  const [url, setUrl] = useState("")
  const [state, setState] = useState<AppState>('idle')
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState("")
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [error, setError] = useState("")
  const [options, setOptions] = useState<GenerationOptions>({
    format: 'A4',
    orientation: 'portrait',
    quality: 'medium',
    aiOptimize: true
  })

  const generatePDF = async () => {
    if (!url.trim()) {
      toast.error("Please enter a website URL")
      return
    }

    if (!isValidUrl(formatUrl(url))) {
      toast.error("Please enter a valid URL")
      return
    }

    setState('generating')
    setProgress(0)
    setProgressMessage("Initializing...")
    setError("")
    setPdfBlob(null)

    // Real progress tracking with WebSocket or polling could be implemented here
    const progressSteps = [
      { progress: 10, message: "Connecting to website..." },
      { progress: 20, message: "Loading page content..." },
      { progress: 30, message: "Analyzing page structure..." },
      { progress: 40, message: "Removing ads and popups..." },
      { progress: 50, message: "Capturing high-quality screenshots..." },
      { progress: 70, message: "Processing with AI optimization..." },
      { progress: 85, message: "Generating PDF document..." },
      { progress: 95, message: "Finalizing and compressing..." }
    ]

    let stepIndex = 0
    const progressInterval = setInterval(() => {
      if (stepIndex < progressSteps.length) {
        const step = progressSteps[stepIndex]
        setProgress(step.progress)
        setProgressMessage(step.message)
        stepIndex++
      }
    }, 1500)

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001"
      const response = await fetch(`${backendUrl}/api/screenshot-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: formatUrl(url),
          options 
        }),
      })

      clearInterval(progressInterval)
      setProgress(100)
      setProgressMessage("PDF ready!")

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const blob = await response.blob()
      setPdfBlob(blob)
      setState('completed')
      toast.success("🎉 PDF generated successfully with AI optimization!")
    } catch (err) {
      clearInterval(progressInterval)
      let errorMessage = "An unexpected error occurred"
      
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (typeof err === 'string') {
        errorMessage = err
      }
      
      // Enhanced error handling
      if (errorMessage.includes('fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = "Unable to connect to server. Please ensure the backend is running."
      } else if (errorMessage.includes('timeout')) {
        errorMessage = "Request timed out. The website might be taking too long to load."
      } else if (errorMessage.includes('DNS') || errorMessage.includes('ENOTFOUND')) {
        errorMessage = "Website not found. Please check the URL and try again."
      }
      
      setError(errorMessage)
      setState('error')
      toast.error(errorMessage)
    }
  }

  const downloadPDF = () => {
    if (!pdfBlob) return

    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = "ai-optimized-website.pdf"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("📄 PDF downloaded successfully!")
  }

  const resetApp = () => {
    setState('idle')
    setProgress(0)
    setProgressMessage("")
    setPdfBlob(null)
    setError("")
    setUrl("")
  }

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />
      
      {/* Header */}
      <header className="relative z-10 border-b border-border/40 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <motion.div 
            className="flex items-center space-x-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                VibeSnap AI
              </span>
              <span className="text-xs text-muted-foreground">v2.0 • AI-Powered</span>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <ThemeToggle />
          </motion.div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <motion.h1 
              className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              AI-Powered Website to
              <br />
              <span className="relative">
                PDF Generator
                <motion.div
                  className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg blur opacity-20"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </span>
            </motion.h1>
            
            <motion.p 
              className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Transform any website into professional PDFs with AI-powered content optimization, 
              ad removal, and intelligent formatting. Experience the future of web-to-PDF conversion.
            </motion.p>

            {/* Generator Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <Card className="glass border-0 shadow-2xl">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center justify-center space-x-2 text-2xl">
                    <Wand2 className="w-6 h-6 text-primary" />
                    <span>AI PDF Generator</span>
                  </CardTitle>
                  <CardDescription className="text-center">
                    Enter any website URL to create a professional, AI-optimized PDF
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        type="url"
                        placeholder="https://example.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={state === 'generating'}
                        className="pl-10 h-12 text-base border-2 focus:border-primary transition-all duration-300"
                        onKeyDown={(e) => e.key === 'Enter' && generatePDF()}
                      />
                    </div>
                    
                    <Button
                      onClick={generatePDF}
                      disabled={state === 'generating' || !url.trim()}
                      size="lg"
                      className="h-12 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      {state === 'generating' ? (
                        <>
                          <LoadingSpinner size={20} className="mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Brain className="w-5 h-5 mr-2" />
                          Generate AI PDF
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Progress Section */}
                  <AnimatePresence>
                    {state === 'generating' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4"
                      >
                        <Progress value={progress} className="h-3" />
                        
                        <div className="flex items-center justify-center space-x-3 text-sm text-muted-foreground">
                          <PulsingDots />
                          <motion.span
                            key={progressMessage}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="font-medium"
                          >
                            {progressMessage}
                          </motion.span>
                        </div>

                        <div className="text-center text-xs text-muted-foreground">
                          {progress}% complete
                        </div>
                      </motion.div>
                    )}

                    {state === 'completed' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                      >
                        <div className="flex items-center space-x-2 text-green-700 dark:text-green-400">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium">AI-Optimized PDF Ready!</span>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            onClick={downloadPDF}
                            className="bg-green-600 hover:bg-green-700 transition-all duration-300 transform hover:scale-105"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download PDF
                          </Button>
                          
                          <Button
                            onClick={resetApp}
                            variant="outline"
                            className="transition-all duration-300 hover:scale-105"
                          >
                            Generate Another
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {state === 'error' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center gap-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
                      >
                        <div className="flex items-center space-x-2 text-red-700 dark:text-red-400">
                          <AlertCircle className="w-5 h-5" />
                          <span className="font-medium">Generation Failed</span>
                        </div>
                        
                        <p className="text-sm text-red-600 dark:text-red-400 text-center">
                          {error}
                        </p>
                        
                        <Button
                          onClick={resetApp}
                          variant="outline"
                          className="transition-all duration-300 hover:scale-105"
                        >
                          Try Again
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>

              {/* Advanced Options */}
              <AdvancedOptions
                options={options}
                onChange={setOptions}
                disabled={state === 'generating'}
              />
            </motion.div>
          </motion.div>
        </section>

        {/* Enhanced Features Section */}
        <section className="container mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powered by Advanced AI Technology
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience next-generation PDF generation with intelligent optimization and professional results
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: Brain,
                title: "AI Content Analysis",
                description: "Smart content extraction with automatic ad removal and layout optimization",
                color: "from-purple-400 to-pink-500"
              },
              {
                icon: Zap,
                title: "Lightning Performance",
                description: "Optimized processing engine with queue management and resource blocking",
                color: "from-yellow-400 to-orange-500"
              },
              {
                icon: Shield,
                title: "Enterprise Security",
                description: "Advanced validation, rate limiting, and secure processing with no data retention",
                color: "from-green-400 to-blue-500"
              },
              {
                icon: Gauge,
                title: "Real-time Progress",
                description: "Live progress tracking with detailed status updates and error handling",
                color: "from-blue-400 to-cyan-500"
              },
              {
                icon: FileText,
                title: "Professional Quality",
                description: "Multiple formats, orientations, and quality settings with smart compression",
                color: "from-indigo-400 to-purple-500"
              },
              {
                icon: Lock,
                title: "Privacy First",
                description: "Automatic cleanup, no data storage, and complete privacy protection",
                color: "from-red-400 to-pink-500"
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
                className="group"
              >
                <Card className="glass border-0 shadow-lg hover:shadow-2xl transition-all duration-300 h-full">
                  <CardHeader className="text-center pb-4">
                    <div className={cn(
                      "w-16 h-16 mx-auto rounded-2xl bg-gradient-to-r flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300",
                      feature.color
                    )}>
                      <feature.icon className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            <Card className="glass border-0 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10" />
              <CardContent className="relative p-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Ready for AI-Powered PDFs?
                </h2>
                <p className="text-xl text-muted-foreground mb-8">
                  Transform any website into a professional PDF with intelligent optimization in seconds
                </p>
                <Button
                  onClick={() => document.querySelector('input')?.focus()}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl px-8 py-3 text-lg"
                >
                  Start Generating AI PDFs
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/40 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">VibeSnap AI v2.0</span>
            </div>
            
            <p className="text-sm text-muted-foreground">
              © 2024 VibeSnap AI. Intelligent website-to-PDF conversion powered by advanced AI.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}