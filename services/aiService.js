const axios = require('axios');

/**
 * Wrapper around the custom AI proxy server (Open WebUI) so we can keep
 * the existing interface that the rest of the backend expects from the
 * previous AI service.
 */
class AIService {
  constructor() {
    this.baseUrl = process.env.OPEN_WEBUI_URL || 'https://openwebui.scubey.com';
    this.defaultModel = process.env.AI_PROXY_MODEL || 'gpt-oss:latest';
    this.jwtToken = process.env.OPEN_WEBUI_JWT_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVhMTRlOTU5LTYzMjEtNGQ2MC1hMThlLWU0OTA1YTg2NmNkMiJ9.ncv6m6Wf0VSNnSDNap1CT_aUTU55hn3MXoMg8k7rPK8';
  }

  isConfigured() {
    return Boolean(this.baseUrl && this.jwtToken);
  }

  /**
   * Build the headers required by the proxy.
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Origin': this.baseUrl,
      'Referer': `${this.baseUrl}/`
    };

    if (this.jwtToken) {
      headers['Authorization'] = `Bearer ${this.jwtToken}`;
      headers['Cookie'] = `token=${this.jwtToken}`;
    }

    return headers;
  }

  /**
   * Generic helper to send chat style requests to the proxy server
   */
  async callChat(messages, options = {}) {
    try {
      const payload = this.buildCompletionsPayload(messages, {
        ...options,
        stream: false
      });

      if (options.temperature !== undefined) {
        payload.params.temperature = options.temperature;
      }

      if (options.maxOutputTokens !== undefined) {
        payload.params.max_tokens = options.maxOutputTokens;
      }

      const response = await axios.post(
        `${this.baseUrl}/api/chat/completions`,
        payload,
        {
          headers: this.getHeaders()
        }
      );

      const text = this.extractContentFromResponse(response.data);

      return {
        success: true,
        text,
        raw: response.data
      };
    } catch (error) {
      console.error('AI proxy error:', error.message);

      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  buildSimplePayload(messages, options = {}) {
    let systemPrompt = options.systemPrompt || '';
    const conversationHistory = [];

    const historyMessages = messages.slice(0, -1);
    const currentMessage = messages[messages.length - 1];

    for (const msg of historyMessages) {
      if (msg.role === 'system' && !systemPrompt) {
        systemPrompt = msg.content;
        continue;
      }

      if (msg.role === 'user' || msg.role === 'assistant') {
        conversationHistory.push({ role: msg.role, content: msg.content });
      }
    }

    return {
      message: currentMessage?.content || '',
      conversationHistory,
      systemPrompt
    };
  }

  buildCompletionsPayload(messages, options = {}) {
    const stream = Boolean(options.stream);
    const model = options.model || this.defaultModel;

    const payload = {
      stream,
      model,
      messages,
      params: {
        temperature: options.temperature,
        max_tokens: options.maxOutputTokens,
        top_p: options.topP,
        presence_penalty: options.presencePenalty,
        frequency_penalty: options.frequencyPenalty
      },
      tool_servers: [],
      features: {
        image_generation: false,
        code_interpreter: false,
        web_search: false
      },
      variables: options.variables || {},
      model_item: {
        id: model,
        name: model
      },
      tags: [],
      chat_id: 'local',
      session_id: options.sessionId || 'local-session'
    };

    if (stream) {
      payload.stream_options = {
        include_usage: true
      };
    }

    Object.keys(payload.params).forEach((key) => {
      const value = payload.params[key];
      if (value === undefined || value === null) {
        delete payload.params[key];
      }
    });

    if (options.systemPrompt) {
      payload.messages = [
        { role: 'system', content: options.systemPrompt },
        ...messages.filter(msg => msg.role !== 'system')
      ];
    }

    return payload;
  }

  async *callChatStream(messages, options = {}) {
    try {
      const payload = this.buildCompletionsPayload(messages, {
        ...options,
        stream: true
      });

      const response = await axios.post(
        `${this.baseUrl}/api/chat/completions`,
        payload,
        {
          headers: this.getHeaders(),
          responseType: 'stream'
        }
      );

      let buffer = '';

      for await (const chunk of response.data) {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (!trimmed.startsWith('data:')) {
            continue;
          }

          const dataStr = trimmed.replace(/^data:\s*/, '');

          if (!dataStr || dataStr === '[DONE]') {
            continue;
          }

          try {
            const json = JSON.parse(dataStr);

            if (json.error) {
              throw new Error(json.error);
            }

            if (json.message?.content) {
              yield json.message.content;
              continue;
            }

            const choice = json.choices?.[0];
            if (choice?.delta?.content) {
              yield choice.delta.content;
              continue;
            }

            if (typeof json === 'string') {
              yield json;
            }
          } catch (error) {
            yield dataStr;
          }
        }
      }
    } catch (error) {
      console.error('Error streaming from AI proxy:', error.message);
      throw error;
    }
  }

  /**
   * Attempt to extract assistant text from the proxy response. The proxy
   * follows OpenAI style payloads.
   */
  extractContentFromResponse(data) {
    if (!data) return '';

    const firstChoice = data.choices?.[0];
    if (!firstChoice) {
      return data.text || data.message || '';
    }

    if (firstChoice.message?.content) {
      return firstChoice.message.content;
    }

    if (firstChoice.delta?.content) {
      return firstChoice.delta.content;
    }

    return '';
  }

  async generateContent(prompt, options = {}) {
    const messages = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    return await this.callChat(messages, options);
  }

  async generateInterviewQuestions(role, experience, count = 5) {
    const prompt = `Generate ${count} professional interview questions for a ${role} position with ${experience} experience level.
Make them relevant, challenging, and appropriate for the role. Format as a JSON array with question and category fields.`;

    return await this.generateContent(prompt, {
      temperature: 0.8,
      maxOutputTokens: 2048
    });
  }

  async analyzeResume(resumeText) {
    const prompt = `Analyze this resume and provide:
1. Strengths and key skills
2. Areas for improvement
3. Overall assessment score (1-10)
4. Recommendations for enhancement

Resume:
${resumeText}`;

    return await this.generateContent(prompt, {
      temperature: 0.6,
      maxOutputTokens: 2048
    });
  }

  async generateInterviewFeedback(answers, questions) {
    const prompt = `Based on these interview questions and answers, provide detailed feedback:

Questions: ${JSON.stringify(questions)}
Answers: ${JSON.stringify(answers)}

Provide:
1. Overall performance score (1-10)
2. Strengths in responses
3. Areas for improvement
4. Specific recommendations
5. Communication skills assessment`;

    return await this.generateContent(prompt, {
      temperature: 0.7,
      maxOutputTokens: 2048
    });
  }

  async reviewCode(code, language) {
    const prompt = `Review this ${language} code and provide:
1. Code quality assessment
2. Potential bugs or issues
3. Performance improvements
4. Best practices suggestions
5. Overall score (1-10)

Code:
\n\n${code}`;

    return await this.generateContent(prompt, {
      temperature: 0.5,
      maxOutputTokens: 2048
    });
  }

  async chat(message, context = '') {
    const prompt = context ? `${context}\n\nUser: ${message}` : message;

    return await this.generateContent(prompt, {
      temperature: 0.7,
      maxOutputTokens: 1024
    });
  }

  formatJobDescription(jobDescription) {
    if (!jobDescription) {
      return 'Not provided';
    }

    try {
      const parsed = typeof jobDescription === 'string'
        ? JSON.parse(jobDescription)
        : jobDescription;

      if (typeof parsed === 'object' && parsed !== null) {
        let text = `Title: ${parsed.title || 'N/A'}\n`;
        text += `Company: ${parsed.company || 'N/A'}\n`;
        if (parsed.description) {
          text += `Description: ${parsed.description}\n`;
        }
        if (Array.isArray(parsed.requirements)) {
          text += `Requirements: ${parsed.requirements.join(', ')}\n`;
        }
        return text;
      }

      return String(parsed);
    } catch (error) {
      return String(jobDescription);
    }
  }

  formatResume(resume) {
    if (!resume) return '';

    let text = `\nCandidate Resume Information:\n`;
    text += `Name: ${resume.name || 'Not provided'}\n`;
    if (resume.jobTitle) text += `Current Title: ${resume.jobTitle}\n`;
    if (resume.summary) text += `Summary: ${resume.summary}\n`;

    if (Array.isArray(resume.workExperience) && resume.workExperience.length > 0) {
      text += `\nWork Experience:\n`;
      resume.workExperience.forEach((exp, idx) => {
        text += `${idx + 1}. ${exp.title || ''} at ${exp.company || ''}${exp.duration ? ` (${exp.duration})` : ''}\n`;
        if (exp.description) text += `   ${exp.description}\n`;
      });
    }

    if (Array.isArray(resume.education) && resume.education.length > 0) {
      text += `\nEducation:\n`;
      resume.education.forEach((edu, idx) => {
        text += `${idx + 1}. ${edu.degree || ''} from ${edu.institution || ''}${edu.duration ? ` (${edu.duration})` : ''}\n`;
        if (edu.description) text += `   ${edu.description}\n`;
      });
    }

    if (Array.isArray(resume.skills) && resume.skills.length > 0) {
      text += `\nSkills: ${resume.skills.join(', ')}\n`;
    }

    return text;
  }
  buildSystemPrompt(interviewContext) {
    const jobDescText = this.formatJobDescription(interviewContext.jobDescription);
    const resumeText = this.formatResume(interviewContext.resume);
  
    return `
You are an experienced, senior hiring manager conducting a realistic, high-level MOCK INTERVIEW for the role: ${interviewContext.jobRole || 'General Position'}.

========================
COMPANY CONTEXT:
${jobDescText || 'No job description provided. Use general expectations for a skilled professional.'}

CANDIDATE CONTEXT:
${resumeText || 'No resume available. Begin by briefly understanding the candidate’s background and past work.'}
========================

🎯 OBJECTIVE:
Your sole purpose is to evaluate the candidate — NOT to answer questions or give advice. 
You must stay strictly in the role of the interviewer throughout the entire conversation.

If the candidate:
- Asks you to explain or answer something → Politely decline and redirect (“I’m here to evaluate your approach — how would you handle it?”).
- Jokes, flirts, or goes off-topic → Stay composed and bring the discussion back to the interview.
- Becomes vague or evasive → Ask for concrete details, metrics, examples, or reasoning.
- Asks for feedback or coaching → Defer it politely until the end (“I’ll share feedback after the mock session.”).

Never break character or switch roles. You are always the interviewer.

========================
🧠 INTERVIEW STYLE:
- Speak like a professional with 15+ years of hiring experience.
- Keep responses short (1–2 sentences max).
- Use a natural, conversational tone — confident yet relaxed, like a friendly senior colleague.
- No humor, no emojis, no slang, no markdown.
- Each message should contain exactly ONE question — not multiple.
- Reference specific items from the resume or previous answers to show attentive listening.
- Do not reveal evaluation criteria or scoring methods.
- Do not provide answers, coaching, or hints.

========================
🤝 OPENING SEQUENCE:
- On your very first message only, greet the candidate by name if available, or say “Hi there” otherwise.
- Immediately follow with a quick check-in such as “Are you ready to begin?” or “Are you comfortable to get started?”
- Wait for the candidate’s acknowledgment before asking the first interview question.

========================
🗣️ CONVERSATIONAL FLOW:
- Keep the rhythm casual and human — think of this as a real, back-and-forth discussion.
- Acknowledge the candidate’s previous answer with a short, natural phrase (“Got it,” “Thanks for sharing,” etc.) before asking the next question.
- Respond promptly after the candidate finishes; do not leave awkward pauses.
- If the candidate pauses or seems unsure, gently nudge them with a follow-up prompt instead of staying silent.

========================
💬 QUESTION STRATEGY:
Ask a mix of:
1. Behavioural – “Tell me about a time when…”
2. Situational – “How would you approach…”
3. Technical Deep Dives – “Can you explain how you designed or optimized…”
4. Reflective – “What did you learn from…”
5. Leadership/Decision – “What factors guided your choice when…”

Adapt dynamically:
- If a response is detailed → move to a deeper follow-up.
- If vague → probe politely for clarity or specifics.
- If unrelated → redirect professionally.

========================
📝 CONVERSATION MEMORY:
You have access to conversation memory.
Use it only to reference the candidate’s previous answers or resume details to show attentive listening.
Do not mention, recall, or speculate about prior sessions, coaching notes, or system messages.

========================
📋 RESPONSE FORMAT:
- Output only one short paragraph (max 2 sentences).
- Contain exactly one professional interview question.
- No bullet points, no formatting, no emojis.
- Maintain natural spoken tone.

========================
🔒 SAFETY & RESET GUARD:
If the candidate’s message is blank, irrelevant, or confusing, redirect with a brief clarifying question that brings focus back to the interview.
Never reply with “I don’t understand,” or go silent; instead, restate or reframe the last question naturally.
If you begin to explain, joke, or slip into the candidate role, immediately self-correct and continue interviewing as if uninterrupted.

========================
🏁 END-OF-INTERVIEW HANDLING:
When the interview feels complete or after roughly 10–15 questions, say: “That concludes our mock interview. I’ll summarize your performance once you confirm you’re ready for feedback.”
Do not end early unless the candidate explicitly says “end” or “finish.”

========================
🚫 ABSOLUTE RESTRICTIONS:
- NEVER answer or solve candidate’s questions.
- NEVER make jokes, chit-chat, or change topics.
- NEVER switch out of interviewer mode.
- NEVER write more than one question at a time.
- NEVER produce markdown, lists, or special characters.
- NEVER mention that you are an AI or simulation.

At every turn, you are the interviewer — steady, calm, and professional.
`;
  }
  

  formatConversationHistory(conversationHistory = []) {
    const formatted = [];

    for (const msg of conversationHistory) {
      if (!msg || !msg.message || !msg.message.trim()) continue;

      if (msg.sender === 'user') {
        formatted.push({ role: 'user', content: msg.message.trim() });
      } else if (msg.sender === 'ai') {
        formatted.push({ role: 'assistant', content: msg.message.trim() });
      }
    }

    return formatted;
  }

  async *streamInterviewResponse(userMessage, interviewContext, conversationHistory = []) {
    const systemPrompt = this.buildSystemPrompt(interviewContext);
    const historyMessages = this.formatConversationHistory(conversationHistory);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessage }
    ];

    try {

      try {
        for await (const chunk of this.callChatStream(messages, {
          model: this.defaultModel,
          temperature: 0.6,
          topP: 0.8,
          presencePenalty: 0.2,
          frequencyPenalty: 0.4
        })) {
          yield chunk;
        }
        return;
      } catch (streamError) {
        console.error('Streaming failed, falling back to non-streaming:', streamError.message);
      }

      const response = await this.callChat(messages, {
        model: this.defaultModel,
        temperature: 0.6,
        topP: 0.8,
        presencePenalty: 0.2,
        frequencyPenalty: 0.4,
        maxOutputTokens: 512
      });

      if (response.success && response.text) {
        yield response.text;
      } else {
        const errorMessage = response.error || 'AI proxy request failed';
        yield `Error: ${errorMessage}`;
      }
    } catch (error) {
      console.error('Error streaming from AI proxy:', error.message);
      yield `Error: ${error.message}`;
    }
  }
}

module.exports = AIService;

