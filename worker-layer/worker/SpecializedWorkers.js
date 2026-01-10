// worker/SpecializedWorkers.js
import { BaseWorker } from './BaseWorker.js';

// Research Worker - handles web research, data gathering
export class ResearchWorker extends BaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'ResearchAgent',
      capabilities: ['research', 'web_search', 'data_gathering', 'summarization']
    });
  }

  async processTask(task, context) {
    const { action, query, sources } = task.payload;

    switch (action) {
      case 'search':
        return await this.performSearch(query, context);
      case 'summarize':
        return await this.summarizeContent(task.payload.content, context);
      case 'gather_data':
        return await this.gatherData(sources, query, context);
      default:
        throw new Error(`Unknown research action: ${action}`);
    }
  }

  async performSearch(query, context) {
    const prompt = `
      Context from previous work: ${JSON.stringify(context)}
      
      Research query: ${query}
      
      Provide a comprehensive research summary including:
      1. Key findings
      2. Relevant data points
      3. Sources to explore further
      4. Confidence level in findings
    `;

    const result = await this.callLLM(prompt, 
      'You are a research specialist. Provide thorough, accurate research findings.');

    return {
      type: 'research_result',
      query,
      findings: result,
      timestamp: new Date(),
      contextUpdate: { ...context, lastResearch: { query, result, at: new Date() } }
    };
  }

  async summarizeContent(content, context) {
    const prompt = `Summarize the following content concisely:\n\n${content}`;
    const summary = await this.callLLM(prompt, 'You are an expert summarizer.');
    return { type: 'summary', summary, originalLength: content.length };
  }

  async gatherData(sources, query, context) {
    const results = [];
    for (const source of sources) {
      const prompt = `Extract relevant information about "${query}" from: ${source}`;
      const data = await this.callLLM(prompt);
      results.push({ source, data });
    }
    return { type: 'gathered_data', results, query };
  }
}

// Code Worker - handles code generation, review, debugging
export class CodeWorker extends BaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'CodeAgent',
      capabilities: ['code_generation', 'code_review', 'debugging', 'refactoring']
    });
  }

  async processTask(task, context) {
    const { action, code, language, requirements } = task.payload;

    switch (action) {
      case 'generate':
        return await this.generateCode(requirements, language, context);
      case 'review':
        return await this.reviewCode(code, language, context);
      case 'debug':
        return await this.debugCode(code, task.payload.error, context);
      case 'refactor':
        return await this.refactorCode(code, task.payload.goals, context);
      default:
        throw new Error(`Unknown code action: ${action}`);
    }
  }

  async generateCode(requirements, language, context) {
    const prompt = `
      Project context: ${JSON.stringify(context)}
      
      Generate ${language} code for:
      ${requirements}
      
      Include:
      - Clean, well-documented code
      - Error handling
      - Unit test suggestions
    `;

    const code = await this.callLLM(prompt,
      `You are an expert ${language} developer. Write production-quality code.`);

    return {
      type: 'generated_code',
      language,
      code,
      requirements,
      contextUpdate: { ...context, generatedFiles: [...(context.generatedFiles || []), { language, at: new Date() }] }
    };
  }

  async reviewCode(code, language, context) {
    const prompt = `
      Review this ${language} code:
      \`\`\`${language}
      ${code}
      \`\`\`
      
      Provide:
      1. Security issues
      2. Performance concerns
      3. Best practice violations
      4. Suggestions for improvement
      5. Overall quality score (1-10)
    `;

    const review = await this.callLLM(prompt, 'You are a senior code reviewer.');
    return { type: 'code_review', review, language };
  }

  async debugCode(code, error, context) {
    const prompt = `
      Debug this code that produces the error: ${error}
      
      Code:
      \`\`\`
      ${code}
      \`\`\`
      
      Provide:
      1. Root cause analysis
      2. Fixed code
      3. Explanation of the fix
    `;

    const fix = await this.callLLM(prompt, 'You are an expert debugger.');
    return { type: 'debug_result', originalError: error, fix };
  }

  async refactorCode(code, goals, context) {
    const prompt = `Refactor this code with goals: ${goals.join(', ')}\n\nCode:\n${code}`;
    const refactored = await this.callLLM(prompt, 'You are a refactoring expert.');
    return { type: 'refactored_code', refactored, goals };
  }
}

// Analysis Worker - handles data analysis, insights
export class AnalysisWorker extends BaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'AnalysisAgent',
      capabilities: ['data_analysis', 'pattern_recognition', 'insights', 'reporting']
    });
  }

  async processTask(task, context) {
    const { action, data } = task.payload;

    switch (action) {
      case 'analyze':
        return await this.analyzeData(data, context);
      case 'find_patterns':
        return await this.findPatterns(data, context);
      case 'generate_insights':
        return await this.generateInsights(data, context);
      case 'create_report':
        return await this.createReport(task.payload, context);
      default:
        throw new Error(`Unknown analysis action: ${action}`);
    }
  }

  async analyzeData(data, context) {
    const prompt = `
      Analyze this data: ${JSON.stringify(data)}
      
      Previous context: ${JSON.stringify(context)}
      
      Provide statistical analysis, trends, and key observations.
    `;

    const analysis = await this.callLLM(prompt, 'You are a data analyst.');
    return { type: 'analysis_result', analysis, dataPoints: Array.isArray(data) ? data.length : 1 };
  }

  async findPatterns(data, context) {
    const prompt = `Find patterns and anomalies in: ${JSON.stringify(data)}`;
    const patterns = await this.callLLM(prompt, 'You are a pattern recognition expert.');
    return { type: 'patterns', patterns };
  }

  async generateInsights(data, context) {
    const prompt = `Generate actionable business insights from: ${JSON.stringify(data)}`;
    const insights = await this.callLLM(prompt, 'You are a business intelligence analyst.');
    return { type: 'insights', insights };
  }

  async createReport(payload, context) {
    const prompt = `
      Create a comprehensive report on: ${payload.topic}
      Using data: ${JSON.stringify(payload.data)}
      Format: ${payload.format || 'markdown'}
    `;
    const report = await this.callLLM(prompt, 'You are a professional report writer.');
    return { type: 'report', report, format: payload.format || 'markdown' };
  }
}

// Communication Worker - handles inter-agent communication
export class CommunicationWorker extends BaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'CommunicationAgent',
      capabilities: ['message_routing', 'context_sharing', 'coordination', 'translation']
    });
  }

  async processTask(task, context) {
    const { action } = task.payload;

    switch (action) {
      case 'broadcast':
        return await this.broadcastMessage(task.payload, context);
      case 'request_collaboration':
        return await this.requestCollaboration(task.payload, context);
      case 'share_context':
        return await this.shareContext(task.payload, context);
      default:
        throw new Error(`Unknown communication action: ${action}`);
    }
  }

  async broadcastMessage(payload, context) {
    const { message, targetCapabilities } = payload;
    
    // Find workers with target capabilities
    const targetWorkers = await this.db.collection('workers').find({
      capabilities: { $in: targetCapabilities },
      status: { $ne: 'offline' }
    }).toArray();

    // Store message for each target
    const messageId = `msg_${Date.now()}`;
    await this.db.collection('agent_messages').insertOne({
      messageId,
      from: this.workerId,
      targets: targetWorkers.map(w => w.workerId),
      message,
      createdAt: new Date(),
      read: []
    });

    return { 
      type: 'broadcast_sent', 
      messageId, 
      recipientCount: targetWorkers.length 
    };
  }

  async requestCollaboration(payload, context) {
    const { taskDescription, requiredCapabilities, deadline } = payload;
    
    // Find suitable collaborators
    const collaborators = await this.db.collection('workers').find({
      capabilities: { $in: requiredCapabilities },
      status: 'idle'
    }).toArray();

    // Create collaboration request
    const collabId = `collab_${Date.now()}`;
    await this.db.collection('collaborations').insertOne({
      collabId,
      requestedBy: this.workerId,
      taskDescription,
      requiredCapabilities,
      potentialCollaborators: collaborators.map(c => c.workerId),
      deadline,
      status: 'pending',
      createdAt: new Date()
    });

    return { 
      type: 'collaboration_requested', 
      collabId, 
      availableCollaborators: collaborators.length 
    };
  }

  async shareContext(payload, context) {
    const { contextData, targetWorkers, contextId } = payload;
    
    await this.db.collection('shared_contexts').insertOne({
      contextId: contextId || `ctx_${Date.now()}`,
      sharedBy: this.workerId,
      targetWorkers,
      data: contextData,
      sharedAt: new Date()
    });

    return { type: 'context_shared', contextId };
  }
}
