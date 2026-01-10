// worker/AdvancedWorkers.js
import { BaseWorker } from './BaseWorker.js';

// Planner Worker - Decomposes complex tasks into subtasks
export class PlannerWorker extends BaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'PlannerAgent',
      capabilities: ['planning', 'task_decomposition', 'workflow_design', 'dependency_analysis']
    });
  }

  async processTask(task, context) {
    const { action } = task.payload;

    switch (action) {
      case 'decompose':
        return await this.decomposeTask(task.payload, context);
      case 'create_workflow':
        return await this.createWorkflow(task.payload, context);
      case 'prioritize':
        return await this.prioritizeTasks(task.payload, context);
      default:
        throw new Error(`Unknown planner action: ${action}`);
    }
  }

  async decomposeTask(payload, context) {
    const { goal, constraints, availableAgents } = payload;
    
    const prompt = `
You are a task planning AI. Decompose this goal into subtasks that can be executed by specialized agents.

GOAL: ${goal}

CONSTRAINTS: ${JSON.stringify(constraints || {})}

AVAILABLE AGENTS AND THEIR CAPABILITIES:
${JSON.stringify(availableAgents || ['research', 'code_generation', 'data_analysis', 'summarization'])}

CONTEXT FROM PREVIOUS WORK: ${JSON.stringify(context)}

Return a JSON object with this structure:
{
  "subtasks": [
    {
      "id": "subtask_1",
      "description": "what needs to be done",
      "requiredCapability": "which agent capability is needed",
      "dependencies": ["ids of subtasks that must complete first"],
      "priority": 1-10,
      "estimatedComplexity": "low|medium|high",
      "payload": { "action": "specific_action", ...other_params }
    }
  ],
  "executionOrder": ["subtask_1", "subtask_2"],
  "estimatedTotalTime": "rough estimate",
  "criticalPath": ["subtask ids on critical path"]
}

Return ONLY valid JSON, no markdown.`;

    const response = await this.callLLM(prompt, 'You are an expert task planner. Return only valid JSON.');
    
    let plan;
    try {
      plan = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      plan = { rawPlan: response, parseError: true };
    }

    // Queue subtasks automatically if requested
    if (payload.autoQueue && plan.subtasks) {
      for (const subtask of plan.subtasks) {
        await this.db.collection('task_queue').insertOne({
          taskId: `${task.taskId}_${subtask.id}`,
          parentTaskId: task.taskId,
          requiredCapability: subtask.requiredCapability,
          payload: subtask.payload,
          contextId: task.contextId,
          priority: subtask.priority,
          dependencies: subtask.dependencies,
          status: 'pending',
          createdAt: new Date()
        });
      }
    }

    return {
      type: 'task_plan',
      goal,
      plan,
      subtasksQueued: payload.autoQueue ? plan.subtasks?.length : 0,
      contextUpdate: { ...context, lastPlan: { goal, plan, at: new Date() } }
    };
  }

  async createWorkflow(payload, context) {
    const { objective, steps } = payload;
    
    const prompt = `
Design a multi-agent workflow for: ${objective}

${steps ? `Suggested steps: ${JSON.stringify(steps)}` : ''}

Create a workflow with:
1. Agent assignments
2. Data flow between agents
3. Decision points
4. Error handling strategies
5. Success criteria

Return as JSON with structure:
{
  "workflow": {
    "name": "workflow name",
    "stages": [
      {
        "id": "stage_1",
        "agent": "agent_type",
        "action": "what to do",
        "inputs": ["from previous stages"],
        "outputs": ["what it produces"],
        "onSuccess": "next_stage_id",
        "onFailure": "fallback_action"
      }
    ]
  }
}`;

    const response = await this.callLLM(prompt);
    let workflow;
    try {
      workflow = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      workflow = { rawWorkflow: response };
    }

    return { type: 'workflow', objective, workflow };
  }

  async prioritizeTasks(payload, context) {
    const { tasks, criteria } = payload;
    
    const prompt = `
Prioritize these tasks based on: ${criteria || 'impact, urgency, dependencies'}

Tasks: ${JSON.stringify(tasks)}

Return JSON: { "prioritizedTasks": [...tasks with priority scores], "reasoning": "..." }`;

    const response = await this.callLLM(prompt);
    let result;
    try {
      result = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      result = { rawResult: response };
    }

    return { type: 'prioritized_tasks', result };
  }
}

// Web Scraper Worker - Fetches and processes web content
export class WebScraperWorker extends BaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'WebScraperAgent',
      capabilities: ['web_scraping', 'url_fetch', 'content_extraction', 'link_discovery']
    });
  }

  async processTask(task, context) {
    const { action } = task.payload;

    switch (action) {
      case 'fetch':
        return await this.fetchUrl(task.payload, context);
      case 'extract':
        return await this.extractContent(task.payload, context);
      case 'discover_links':
        return await this.discoverLinks(task.payload, context);
      default:
        throw new Error(`Unknown scraper action: ${action}`);
    }
  }

  async fetchUrl(payload, context) {
    const { url, selector } = payload;
    
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'HackathonBot/1.0' }
      });
      const html = await response.text();
      
      // Use LLM to extract meaningful content
      const prompt = `
Extract the main content from this HTML. ${selector ? `Focus on: ${selector}` : ''}

HTML (truncated to 4000 chars):
${html.substring(0, 4000)}

Return JSON: { "title": "...", "mainContent": "...", "metadata": {...} }`;

      const extracted = await this.callLLM(prompt);
      let content;
      try {
        content = JSON.parse(extracted.replace(/```json\n?|\n?```/g, '').trim());
      } catch (e) {
        content = { rawContent: extracted };
      }

      return {
        type: 'fetched_content',
        url,
        content,
        fetchedAt: new Date(),
        contextUpdate: { ...context, fetchedUrls: [...(context.fetchedUrls || []), url] }
      };
    } catch (error) {
      return { type: 'fetch_error', url, error: error.message };
    }
  }

  async extractContent(payload, context) {
    const { html, extractionRules } = payload;
    
    const prompt = `
Extract structured data from this HTML based on these rules:
${JSON.stringify(extractionRules)}

HTML:
${html.substring(0, 4000)}

Return extracted data as JSON.`;

    const extracted = await this.callLLM(prompt);
    return { type: 'extracted_content', data: extracted };
  }

  async discoverLinks(payload, context) {
    const { html, filter } = payload;
    
    const prompt = `
Find all relevant links in this HTML. ${filter ? `Filter: ${filter}` : ''}

HTML:
${html.substring(0, 4000)}

Return JSON: { "links": [{"url": "...", "text": "...", "relevance": "high|medium|low"}] }`;

    const links = await this.callLLM(prompt);
    return { type: 'discovered_links', links };
  }
}

// Synthesis Worker - Combines outputs from multiple agents
export class SynthesisWorker extends BaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'SynthesisAgent',
      capabilities: ['synthesis', 'aggregation', 'report_generation', 'conclusion_drawing']
    });
  }

  async processTask(task, context) {
    const { action } = task.payload;

    switch (action) {
      case 'combine':
        return await this.combineResults(task.payload, context);
      case 'generate_report':
        return await this.generateReport(task.payload, context);
      case 'draw_conclusions':
        return await this.drawConclusions(task.payload, context);
      case 'summarize_workflow':
        return await this.summarizeWorkflow(task.payload, context);
      default:
        throw new Error(`Unknown synthesis action: ${action}`);
    }
  }

  async combineResults(payload, context) {
    const { results, combineStrategy } = payload;
    
    const prompt = `
Combine these results from multiple AI agents into a coherent output.

RESULTS FROM AGENTS:
${JSON.stringify(results, null, 2)}

COMBINATION STRATEGY: ${combineStrategy || 'merge and deduplicate, resolve conflicts, create unified view'}

Create a combined output that:
1. Merges all findings
2. Resolves any contradictions
3. Highlights consensus points
4. Notes areas of uncertainty

Return JSON: { "combined": {...}, "conflicts": [...], "confidence": 0-100, "summary": "..." }`;

    const response = await this.callLLM(prompt);
    let combined;
    try {
      combined = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      combined = { rawCombined: response };
    }

    return { type: 'combined_results', combined };
  }

  async generateReport(payload, context) {
    const { title, sections, data, format } = payload;
    
    const prompt = `
Generate a comprehensive report.

TITLE: ${title}
SECTIONS TO INCLUDE: ${JSON.stringify(sections || ['Executive Summary', 'Findings', 'Recommendations'])}
DATA: ${JSON.stringify(data)}
FORMAT: ${format || 'markdown'}

Create a professional report with clear structure and actionable insights.`;

    const report = await this.callLLM(prompt, 'You are a professional report writer.');

    return {
      type: 'generated_report',
      title,
      report,
      format: format || 'markdown',
      generatedAt: new Date()
    };
  }

  async drawConclusions(payload, context) {
    const { evidence, question } = payload;
    
    const prompt = `
Based on this evidence, draw conclusions.

QUESTION/OBJECTIVE: ${question}

EVIDENCE:
${JSON.stringify(evidence, null, 2)}

Provide:
1. Main conclusions
2. Confidence level for each
3. Supporting evidence
4. Caveats and limitations
5. Recommended next steps

Return as JSON.`;

    const conclusions = await this.callLLM(prompt);
    return { type: 'conclusions', question, conclusions };
  }

  async summarizeWorkflow(payload, context) {
    const { workflowId, taskResults } = payload;
    
    // Fetch all results for this workflow from MongoDB
    let results = taskResults;
    if (!results && workflowId) {
      results = await this.db.collection('task_results')
        .find({ taskId: { $regex: workflowId } })
        .toArray();
    }

    const prompt = `
Summarize the results of this multi-agent workflow.

WORKFLOW RESULTS:
${JSON.stringify(results, null, 2)}

Provide:
1. Overall outcome
2. What each agent contributed
3. Key findings
4. Any issues encountered
5. Final deliverables`;

    const summary = await this.callLLM(prompt);
    return { type: 'workflow_summary', workflowId, summary };
  }
}

// Memory Worker - Persistent memory for agents
export class MemoryWorker extends BaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'MemoryAgent',
      capabilities: ['memory_store', 'memory_retrieve', 'memory_search', 'knowledge_graph']
    });
  }

  async processTask(task, context) {
    const { action } = task.payload;

    switch (action) {
      case 'store':
        return await this.storeMemory(task.payload, context);
      case 'retrieve':
        return await this.retrieveMemory(task.payload, context);
      case 'search':
        return await this.searchMemory(task.payload, context);
      case 'build_graph':
        return await this.buildKnowledgeGraph(task.payload, context);
      default:
        throw new Error(`Unknown memory action: ${action}`);
    }
  }

  async storeMemory(payload, context) {
    const { key, value, tags, expiresIn } = payload;
    
    const memory = {
      key,
      value,
      tags: tags || [],
      createdAt: new Date(),
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn) : null,
      accessCount: 0
    };

    await this.db.collection('agent_memory').updateOne(
      { key },
      { $set: memory },
      { upsert: true }
    );

    return { type: 'memory_stored', key, tags };
  }

  async retrieveMemory(payload, context) {
    const { key, keys } = payload;
    
    if (key) {
      const memory = await this.db.collection('agent_memory').findOneAndUpdate(
        { key },
        { $inc: { accessCount: 1 } },
        { returnDocument: 'after' }
      );
      return { type: 'memory_retrieved', key, value: memory?.value, found: !!memory };
    }

    if (keys) {
      const memories = await this.db.collection('agent_memory')
        .find({ key: { $in: keys } })
        .toArray();
      return { type: 'memories_retrieved', memories };
    }

    return { type: 'error', message: 'No key or keys provided' };
  }

  async searchMemory(payload, context) {
    const { query, tags, limit } = payload;
    
    let filter = {};
    if (tags) filter.tags = { $in: tags };
    
    const memories = await this.db.collection('agent_memory')
      .find(filter)
      .limit(limit || 10)
      .toArray();

    // Use LLM to rank by relevance to query
    if (query && memories.length > 0) {
      const prompt = `
Rank these memories by relevance to query: "${query}"

Memories:
${JSON.stringify(memories.map(m => ({ key: m.key, value: m.value, tags: m.tags })))}

Return JSON: { "ranked": [{ "key": "...", "relevance": 0-100, "reason": "..." }] }`;

      const ranked = await this.callLLM(prompt);
      return { type: 'memory_search', query, results: ranked };
    }

    return { type: 'memory_search', query, results: memories };
  }

  async buildKnowledgeGraph(payload, context) {
    const { entities, relationships } = payload;
    
    // Store entities and relationships
    if (entities) {
      for (const entity of entities) {
        await this.db.collection('knowledge_graph').updateOne(
          { entityId: entity.id },
          { $set: { ...entity, updatedAt: new Date() } },
          { upsert: true }
        );
      }
    }

    if (relationships) {
      for (const rel of relationships) {
        await this.db.collection('knowledge_graph_edges').updateOne(
          { from: rel.from, to: rel.to, type: rel.type },
          { $set: { ...rel, updatedAt: new Date() } },
          { upsert: true }
        );
      }
    }

    return { 
      type: 'knowledge_graph_updated', 
      entitiesAdded: entities?.length || 0,
      relationshipsAdded: relationships?.length || 0
    };
  }
}

// Validator Worker - Quality checks on agent outputs
export class ValidatorWorker extends BaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'ValidatorAgent',
      capabilities: ['validation', 'quality_check', 'fact_check', 'consistency_check']
    });
  }

  async processTask(task, context) {
    const { action } = task.payload;

    switch (action) {
      case 'validate':
        return await this.validateOutput(task.payload, context);
      case 'fact_check':
        return await this.factCheck(task.payload, context);
      case 'check_consistency':
        return await this.checkConsistency(task.payload, context);
      case 'score_quality':
        return await this.scoreQuality(task.payload, context);
      default:
        throw new Error(`Unknown validator action: ${action}`);
    }
  }

  async validateOutput(payload, context) {
    const { output, schema, rules } = payload;
    
    const prompt = `
Validate this output against the given criteria.

OUTPUT TO VALIDATE:
${JSON.stringify(output)}

${schema ? `EXPECTED SCHEMA: ${JSON.stringify(schema)}` : ''}
${rules ? `VALIDATION RULES: ${JSON.stringify(rules)}` : ''}

Check for:
1. Completeness
2. Correctness
3. Format compliance
4. Logical consistency

Return JSON: {
  "isValid": true/false,
  "errors": [...],
  "warnings": [...],
  "suggestions": [...],
  "score": 0-100
}`;

    const validation = await this.callLLM(prompt);
    let result;
    try {
      result = JSON.parse(validation.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      result = { rawValidation: validation };
    }

    return { type: 'validation_result', result };
  }

  async factCheck(payload, context) {
    const { claims, sources } = payload;
    
    const prompt = `
Fact-check these claims.

CLAIMS:
${JSON.stringify(claims)}

${sources ? `REFERENCE SOURCES: ${JSON.stringify(sources)}` : ''}

For each claim, provide:
1. Verdict: true/false/unverifiable
2. Confidence: 0-100
3. Evidence or reasoning
4. Suggested corrections if false

Return JSON array of fact-check results.`;

    const factCheck = await this.callLLM(prompt);
    return { type: 'fact_check', results: factCheck };
  }

  async checkConsistency(payload, context) {
    const { items, checkType } = payload;
    
    const prompt = `
Check consistency across these items.

ITEMS:
${JSON.stringify(items)}

CHECK TYPE: ${checkType || 'general consistency'}

Identify:
1. Contradictions
2. Inconsistencies
3. Gaps
4. Redundancies

Return JSON: { "isConsistent": true/false, "issues": [...], "recommendations": [...] }`;

    const consistency = await this.callLLM(prompt);
    return { type: 'consistency_check', results: consistency };
  }

  async scoreQuality(payload, context) {
    const { content, criteria } = payload;
    
    const prompt = `
Score the quality of this content.

CONTENT:
${JSON.stringify(content)}

CRITERIA: ${JSON.stringify(criteria || ['accuracy', 'completeness', 'clarity', 'usefulness'])}

For each criterion, provide a score 0-100 and explanation.
Also provide an overall score.

Return JSON: { "scores": { "criterion": { "score": N, "explanation": "..." } }, "overall": N, "summary": "..." }`;

    const quality = await this.callLLM(prompt);
    let result;
    try {
      result = JSON.parse(quality.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      result = { rawQuality: quality };
    }

    return { type: 'quality_score', result };
  }
}