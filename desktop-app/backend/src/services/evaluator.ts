import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../utils/crypto';

const prisma = new PrismaClient();

export const DEFAULT_RESUME = `
CHANDAN PANDEY
+91 6205330891 | chandan.works.91@gmail.com | linkedin.com/in/chandan-pandey91 | github.com/404chandan | Portfolio

PROFESSIONAL SUMMARY
• Software engineer at Siemens with previous internship experience at HighRadius, strong foundation in Web Development, Machine Learning, Data Structures and Algorithms; graduate of the National Institute of Technology, Jamshedpur.

WORK EXPERIENCE
Siemens DISW | Feb 2026 – Present
Software Engineer | Bengaluru, India
• Built backend automation services for InsightPro using Python and Golang, reducing manual effort by 80%.
• Integrated PBS workload manager with InsightPro for centralized job monitoring and workload visibility.
• Developed scalable backend workflows for infrastructure monitoring, log analysis, and system diagnostics.
• Implemented AI-driven troubleshooting solutions to automate root-cause analysis and issue resolution.
• Optimized backend performance using Redis, improving response latency and system reliability.
• Containerized and deployed backend services with Docker and AWS for scalable operations.
• Technologies Used: Python, Golang, Redis, Docker, AWS, Linux, Playwright, Generative AI

HighRadius | July 2025 – Jan 2026
Software Engineer | Hyderabad, India
• Developed backend services for the Deduction Management System, streamlining deduction workflows.
• Built ML-powered invoice extraction pipelines to automate financial document processing.
• Automated dispute creation from invoices and bills, reducing manual effort and improving efficiency.
• Designed intelligent workflows for deduction validation, dispute resolution, and exception handling.
• Developed document preprocessing pipelines, achieving 95% extraction accuracy.
• Built and optimized RESTful APIs for financial document processing and workflow automation.
• Technologies Used: Express.js, Python, JavaScript, Microservices, Docker, MySQL

EDUCATION
National Institute of Technology, Jamshedpur | Nov 2022 - May 2026
Bachelor of Technology - CGPA: 8.15 | Jharkhand, India

TECHNICAL SKILLS
• Programming Languages: C/C++, Python, Go, JavaScript, SQL
• Backend Engineering: Go, Python, Node.js, Express.js, REST APIs, FastAPI, Microservices
• Databases & Caching: PostgreSQL, MongoDB, Redis
• Cloud & DevOps: AWS, Docker, Linux, Git, CI/CD
• AI & Machine Learning: Generative AI, LLM Applications, RAG
• Computer Science Fundamentals: OOP, Operating Systems, High-Level Design

PROJECTS
ScaleCheck | Website | GitHub
• Built a real-time system design and load-testing platform for architecture modeling and bottleneck detection.
• Designed an interactive topology canvas using React Flow for multi-tier architecture visualization.
• Developed live traffic simulation with dynamic packet flow visualization under variable loads.
• Implemented SSE-based stress testing with real-time metrics including RPS, latency, and failures.
• Created automated architecture validation to detect SPOFs, missing replicas, and scaling issues.
• Technologies Used: React.js, React Flow, Chart.js, Node.js, Express.js, SSE, REST APIs
`;

interface EvaluationResult {
  score: number;
  matchingSkills: string[];
  missingSkills: string[];
  reason: string;
  coldEmailDraft: string;
}

export async function getActiveResume(userId: string): Promise<string> {
  try {
    const resumeSetting = await prisma.systemSetting.findFirst({
      where: { userId, key: 'user_resume' }
    });
    if (resumeSetting && resumeSetting.value) {
      return resumeSetting.value;
    }
  } catch (error) {
    logger.error(`Failed to read resume from database for user ${userId}, using default resume`, error);
  }
  return DEFAULT_RESUME;
}

export async function evaluateJob(userId: string, jobTitle: string, company: string, jobDescription: string): Promise<EvaluationResult> {
  let apiKey = config.GEMINI_API_KEY;
  
  try {
    const keySetting = await prisma.systemSetting.findFirst({
      where: { userId, key: 'gemini_api_key' }
    });
    if (keySetting && keySetting.value) {
      apiKey = decrypt(keySetting.value);
    }
  } catch (err) {
    logger.error(`Failed to load custom API key for user ${userId}`, err);
  }

  const resume = await getActiveResume(userId);

  if (!apiKey) {
    logger.warn('No Gemini API Key available (neither in DB nor in .env). Returning mock evaluation.');
    const score = Math.round((2.5 + Math.random() * 2.5) * 10) / 10;
    return {
      score,
      matchingSkills: ['Python', 'Docker', 'REST APIs', 'Node.js'],
      missingSkills: ['Kubernetes', 'GCP'],
      reason: 'This is a mock evaluation because no API Key is configured.',
      coldEmailDraft: `Hi Recruiting Team at ${company},\n\nI recently came across the ${jobTitle} opening and wanted to reach out. With my background in Software Engineering at Siemens, I am highly interested.\n\nBest regards,\nChandan Pandey`
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
You are an expert technical recruiter and talent matching system.
Evaluate the following Job Description against the Candidate's Resume.

### Candidate's Resume
${resume}

### Job Opening
Company: ${company}
Title: ${jobTitle}
Description:
${jobDescription}

### Instructions
1. Calculate a match score between 0.0 and 5.0 (decimals allowed, e.g., 3.7 or 4.5). Be objective. 
   - A score of 5.0 means the candidate is a perfect fit matching all requirements.
   - A score of 3.0 means the candidate meets minimum requirements (60% match).
   - A score below 3.0 means there are significant mismatches.
2. Compile a list of Matching Skills (skills in the resume required for the job).
3. Compile a list of Missing Skills (critical requirements in the job description not explicitly present in the resume).
4. Provide a 2-3 sentence analysis of why the score was given.
5. Draft a highly personalized, compelling cold email (max 200 words) from the candidate (Chandan Pandey, contact details: chandan.works.91@gmail.com, github.com/404chandan, linkedin.com/in/chandan-pandey91) to the recruiter/hiring team at ${company}. Keep it natural, refer to some of his specific accomplishments (like working at Siemens/HighRadius or his ScaleCheck project) that align with this job.

You MUST respond with a single, valid JSON object containing exactly these fields (no other text, no markdown wrapper \`\`\`json, just raw JSON text):
{
  "score": number,
  "matchingSkills": string[],
  "missingSkills": string[],
  "reason": string,
  "coldEmailDraft": string
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
    });

    const responseText = response.text || '';
    
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```json')) cleanedText = cleanedText.substring(7);
    if (cleanedText.endsWith('```')) cleanedText = cleanedText.substring(0, cleanedText.length - 3);
    cleanedText = cleanedText.trim();

    const result = JSON.parse(cleanedText) as EvaluationResult;
    return result;

  } catch (error) {
    logger.error(`Failed to evaluate job matching via Gemini for ${jobTitle} at ${company}`, error);
    return {
      score: 3.0,
      matchingSkills: ['Python', 'Node.js'],
      missingSkills: [],
      reason: 'Failed to complete AI evaluation due to error. Defaulting to 3.0.',
      coldEmailDraft: `Hi Team,\n\nI am interested in the ${jobTitle} role. Please find my resume attached.\n\nBest,\nChandan`
    };
  }
}
