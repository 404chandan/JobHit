import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = new PrismaClient();

async function getOrCreatePreferences(userId: string) {
  let preference = await prisma.userPreference.findFirst({
    where: { userId }
  });
  
  if (!preference) {
    const defaultConfig = {
      roles: ['Software Engineer', 'Backend Engineer'],
      experience: ['0', '0-1'],
      techStack: ['Node.js', 'Python', 'Golang'],
      locations: ['Bangalore'],
      excludeCos: ['TCS', 'Infosys'],
      excludeRls: ['Senior Software Engineer', 'SDE II', 'Lead Engineer']
    };
    
    preference = await prisma.userPreference.create({
      data: {
        userId,
        roles: defaultConfig.roles,
        experience: defaultConfig.experience,
        techStack: defaultConfig.techStack,
        locations: defaultConfig.locations,
        excludeCos: defaultConfig.excludeCos,
        excludeRls: defaultConfig.excludeRls,
        rawJson: JSON.stringify(defaultConfig, null, 2),
        chatHistory: JSON.stringify([])
      }
    });
  }
  return preference;
}

export const getPreferences = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const preference = await getOrCreatePreferences(userId);
    res.json(preference);
  } catch (error) {
    logger.error('Failed to get preferences', error);
    res.status(500).json({ error: 'Failed to retrieve preferences' });
  }
};

export const savePreferences = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { roles, experience, techStack, locations, excludeCos, excludeRls, rawJson } = req.body;

  try {
    const existing = await getOrCreatePreferences(userId);
    
    let finalJson = rawJson;
    let parsedConfig = { roles, experience, techStack, locations, excludeCos, excludeRls };
    
    if (rawJson) {
      try {
        parsedConfig = JSON.parse(rawJson);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid JSON format in configuration editor' });
      }
    } else {
      finalJson = JSON.stringify(parsedConfig, null, 2);
    }

    const updated = await prisma.userPreference.update({
      where: { id: existing.id },
      data: {
        roles: parsedConfig.roles || [],
        experience: parsedConfig.experience || [],
        techStack: parsedConfig.techStack || [],
        locations: parsedConfig.locations || [],
        excludeCos: parsedConfig.excludeCos || [],
        excludeRls: parsedConfig.excludeRls || [],
        rawJson: finalJson
      }
    });

    res.json(updated);
  } catch (error) {
    logger.error('Failed to save preferences', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
};

export const processPreferenceChat = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { message } = req.body;
  const apiKey = config.GEMINI_API_KEY;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const preference = await getOrCreatePreferences(userId);
    let history = [];
    try {
      history = JSON.parse(preference.chatHistory || '[]');
    } catch (e) {
      logger.error('Failed to parse chat history', e);
    }

    history.push({ role: 'user', content: message });

    if (!apiKey) {
      const mockReply = "I've recorded your preferences. In offline mode, the configuration won't be auto-parsed by Gemini, but you can edit the JSON editor side-by-side.";
      history.push({ role: 'assistant', content: mockReply });
      
      await prisma.userPreference.update({
        where: { id: preference.id },
        data: { chatHistory: JSON.stringify(history) }
      });
      return res.json({ message: mockReply, configReady: false, history });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const systemPrompt = `
You are JobHit's Career Configurator Assistant. Your goal is to guide the candidate to set up their job search parameters.
Ask questions one-by-one to clarify:
1. Target Roles (e.g. Software Engineer, Backend Developer)
2. Experience Range (e.g. Fresher, 0-1 years, 1-2 years)
3. Target Locations (e.g. Bangalore, Pune, Remote)
4. Preferred Tech Stack (e.g. Python, Node.js, Golang)
5. Excluded Companies to avoid (e.g. TCS, Wipro)
6. Excluded Roles/Seniority to ignore (e.g. Senior Software Engineer, SDE II, Lead, Manager)

Keep your tone professional, brief, and helpful.
Do not ask for all details at once. Ask them progressively.

If the user indicates they are done, or if you have gathered all six fields, generate the final JSON configuration.
Otherwise, continue the dialogue.

You MUST respond in one of these two JSON formats (with no markdown block wrapper, just raw JSON text):

1) Dialogue Mode (still asking questions):
{
  "configReady": false,
  "message": "Your next follow-up message/question goes here"
}

2) Completion Mode (all details gathered, config ready):
{
  "configReady": true,
  "message": "Thank you! I've updated your search preferences config.",
  "config": {
    "roles": ["string"],
    "experience": ["string"],
    "techStack": ["string"],
    "locations": ["string"],
    "excludeCompanies": ["string"],
    "excludeRoles": ["string"]
  }
}
`;

    const formattedChatHistory = history.map((h: any) => `${h.role === 'user' ? 'Candidate' : 'Assistant'}: ${h.content}`).join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `${systemPrompt}\n\nChat History:\n${formattedChatHistory}\n\nNext action:`,
    });

    let responseText = (response.text || '').trim();
    if (responseText.startsWith('```json')) responseText = responseText.substring(7);
    if (responseText.endsWith('```')) responseText = responseText.substring(0, responseText.length - 3);
    responseText = responseText.trim();

    const parsedRes = JSON.parse(responseText);
    
    history.push({ role: 'assistant', content: parsedRes.message });

    const updateData: any = { chatHistory: JSON.stringify(history) };

    if (parsedRes.configReady && parsedRes.config) {
      const cfg = parsedRes.config;
      updateData.roles = cfg.roles || [];
      updateData.experience = cfg.experience || [];
      updateData.techStack = cfg.techStack || [];
      updateData.locations = cfg.locations || [];
      updateData.excludeCos = cfg.excludeCompanies || [];
      updateData.excludeRls = cfg.excludeRoles || [];
      updateData.rawJson = JSON.stringify({
        roles: cfg.roles,
        experience: cfg.experience,
        techStack: cfg.techStack,
        locations: cfg.locations,
        excludeCompanies: cfg.excludeCompanies,
        excludeRoles: cfg.excludeRoles
      }, null, 2);
    }

    const updated = await prisma.userPreference.update({
      where: { id: preference.id },
      data: updateData
    });

    res.json({
      message: parsedRes.message,
      configReady: parsedRes.configReady,
      history,
      preference: updated
    });

  } catch (error) {
    logger.error('Failed to process preference chatbot message', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
};

export const clearChatHistory = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const preference = await getOrCreatePreferences(userId);
    const updated = await prisma.userPreference.update({
      where: { id: preference.id },
      data: {
        chatHistory: JSON.stringify([])
      }
    });
    res.json({ message: 'Chat history cleared.', preference: updated });
  } catch (error) {
    logger.error('Failed to clear chat history', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
};
