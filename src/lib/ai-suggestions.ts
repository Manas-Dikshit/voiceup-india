// AI Suggestion Types for the civic engagement platform

export interface AISolutionSuggestion {
  title: string;
  description: string;
  impact: string;
  nextStep: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface GenerateSolutionsResult {
  suggestions: AISolutionSuggestion[];
  model: string;
  cached: boolean;
  problemId: string;
}

export interface ChatbotMetadata {
  type: 'suggestion' | 'info' | 'error';
  data: {
    suggestions?: AISolutionSuggestion[];
    problemId?: string;
    model?: string;
    cached?: boolean;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Helper function to call the chatbot edge function
export async function sendChatMessage(
  messages: ChatMessage[],
  supabaseUrl: string,
  anonKey: string
): Promise<{ text: string; metadata?: ChatbotMetadata | null }> {
  const response = await fetch(`${supabaseUrl}/functions/v1/chatbot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send message: ${errorText}`);
  }

  return response.json();
}

// Helper function to generate AI solutions for a problem
export async function generateAISolutions(
  problemId: string,
  problemTitle: string,
  problemDescription: string,
  supabaseUrl: string,
  anonKey: string
): Promise<GenerateSolutionsResult> {
  const response = await fetch(`${supabaseUrl}/functions/v1/generate_solutions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ 
      problemId,
      title: problemTitle,
      description: problemDescription
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate solutions');
  }

  return response.json();
}
