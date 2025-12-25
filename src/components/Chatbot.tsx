import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, Trash2, Sparkles, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
}

interface ChatbotProps {
  problemContext?: {
    id: string;
    title: string;
    description: string;
  };
}

const Chatbot = ({ problemContext }: ChatbotProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Load saved chat from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("chatHistory");
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
  }, []);

  // Save chat + auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("chatHistory", JSON.stringify(messages));
    } else {
      localStorage.removeItem("chatHistory");
    }

    // Auto-scroll to bottom
    if (viewportRef.current) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      text: input.trim(),
      sender: "user",
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Build message history for context
      const chatHistory = messages.map(m => ({
        role: m.sender === "user" ? "user" as const : "assistant" as const,
        content: m.text
      }));

      // Add current message
      chatHistory.push({ role: "user" as const, content: userMessage.text });

      // Call the chatbot edge function
      const { data, error } = await supabase.functions.invoke('chatbot', {
        body: { 
          messages: chatHistory,
          problemContext: problemContext
        }
      });

      if (error) throw error;

      const botMessage: Message = {
        id: crypto.randomUUID(),
        text: data?.text || "I'm sorry, I couldn't process your request.",
        sender: "bot",
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error("Error sending:", err);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        text: "Sorry, I encountered an error. Please try again later.",
        sender: "bot",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-primary/10 to-accent/10">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" /> AI Assistant
        </h2>
        <Button variant="ghost" size="icon" onClick={handleClearChat} title="Clear chat">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div ref={viewportRef} className="space-y-4">

          {messages.length === 0 && !isLoading && (
            <div className="text-center text-muted-foreground py-8">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary/50" />
              <p className="font-medium">Ask me anything about public issues!</p>
              <p className="text-xs mt-2">
                e.g., "How many road problems are there?" or "Suggest solutions for water issues"
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex items-start gap-3",
                msg.sender === "user" && "justify-end"
              )}
            >
              {msg.sender === "bot" && (
                <Avatar className="h-8 w-8 bg-primary/10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}

              <div
                className={cn(
                  "p-3 rounded-lg max-w-xs lg:max-w-md",
                  msg.sender === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              </div>

              {msg.sender === "user" && (
                <Avatar className="h-8 w-8 bg-secondary/10">
                  <AvatarFallback className="bg-secondary/10 text-secondary">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8 bg-primary/10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="p-3 rounded-lg bg-muted flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input box */}
      <div className="p-4 border-t bg-muted/30">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask about public data or chat..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={isLoading} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
