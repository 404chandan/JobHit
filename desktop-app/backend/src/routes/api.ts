import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { 
  getJobs, 
  triggerScrape, 
  triggerAutoApply, 
  resolveScreeningQuestions 
} from '../controllers/job.controller';
import { 
  getContacts, 
  updateDraft, 
  regenerateDraft, 
  sendSingleEmail, 
  triggerLeadGeneration 
} from '../controllers/contact.controller';
import { 
  getSettings, 
  saveSettings, 
  uploadResumeFile 
} from '../controllers/settings.controller';
import { 
  getPreferences, 
  savePreferences, 
  processPreferenceChat, 
  clearChatHistory 
} from '../controllers/chat.controller';
import { 
  uploadCsvCampaign, 
  getCampaigns 
} from '../controllers/campaign.controller';

const router = Router();

// Multer configuration for memory storage (for direct buffer parsing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB cap
});

// Apply JWT Authentication Middleware to all subsequent routes
router.use(authenticate);

// Protected Jobs Routes
router.get('/jobs', getJobs);
router.post('/jobs/scrape', triggerScrape);
router.post('/jobs/:id/apply', triggerAutoApply);
router.post('/jobs/:id/resolve', resolveScreeningQuestions);

// Protected Contacts Routes
router.get('/contacts', getContacts);
router.put('/contacts/:id', updateDraft);
router.post('/contacts/:id/regenerate', regenerateDraft);
router.post('/contacts/:id/send', sendSingleEmail);
router.post('/contacts/scrape', triggerLeadGeneration);

// Protected Preferences Routes (AI Chat & Config Editor)
router.get('/preferences', getPreferences);
router.post('/preferences', savePreferences);
router.post('/preferences/chat', processPreferenceChat);
router.post('/preferences/chat/clear', clearChatHistory);

// Protected CSV Campaigns Routes
router.get('/campaigns', getCampaigns);
router.post('/campaigns/upload', upload.single('campaignCsv'), uploadCsvCampaign);

// Protected Settings Routes
router.get('/settings', getSettings);
router.post('/settings', saveSettings);
router.post('/settings/resume', upload.single('resume'), uploadResumeFile);

export default router;
