export interface CodeProject {
  html: string;
  css: string;
  js: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  code?: CodeProject;
}
