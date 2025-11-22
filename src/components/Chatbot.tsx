import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
}

interface ChatbotProps {
  onSendMessage: (message: string, history: Message[]) => Promise<string>;
  history: Message[];
  setHistory: (history: Message[]) => void;
}

const Chatbot = ({ onSendMessage, history, setHistory }: ChatbotProps) => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load chat history from localStorage on initial render
    const storedMessages = localStorage.getItem("chatHistory");
    if (storedMessages) {
      setHistory(JSON.parse(storedMessages));
    }
  }, [setHistory]);

  useEffect(() => {
    // Save chat history to localStorage whenever it changes
    if (history.length > 0) {
      localStorage.setItem("chatHistory", JSON.stringify(history));
    } else {
      localStorage.removeItem("chatHistory");
    }

    // Auto-scroll to the bottom
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [history]);

  const handleClearChat = () => {
    setHistory([]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const messageToSend = input;
    setInput("");
    setIsLoading(true);

    try {
      await onSendMessage(messageToSend, history);
    } catch (error) {
      // Error is handled in the parent component's onSendMessage
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border rounded-lg shadow-lg">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center">
          <Bot className="mr-2" /> AI Assistant
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClearChat}
          title="Clear Chat"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {history.length === 0 && !isLoading && (
            <div className="text-center text-muted-foreground py-8">
              <p>Ask me anything about public issues or just chat!</p>
              <p className="text-xs mt-2">
                e.g., "How many road problems are there?"
              </p>
            </div>
          )}
          {history.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex items-start gap-3",
                message.sender === "user" ? "justify-end" : ""
              )}
            >
              {message.sender === "bot" && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>AI</AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "p-3 rounded-lg max-w-xs lg:max-w-md",
                  message.sender === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="text-sm">{message.text}</p>
              </div>
              {message.sender === "user" && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    <User />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm animate-pulse">...</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about public data or chat..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
