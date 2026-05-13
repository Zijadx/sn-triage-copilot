/**
 * sn-client/index.js
 *
 * Thin wrapper around ServiceNow REST API.
 * Abstracts auth and endpoint details so the rest of the app
 * never touches raw HTTP calls directly.
 */

const axios = require('axios');

class SNClient {
  constructor() {
    const { SN_INSTANCE_URL, SN_USERNAME, SN_PASSWORD } = process.env;
    if (!SN_INSTANCE_URL || !SN_USERNAME || !SN_PASSWORD) {
      throw new Error('Missing ServiceNow credentials. Check your .env file.');
    }

    this.client = axios.create({
      baseURL: `${SN_INSTANCE_URL}/api/now`,
      auth: { username: SN_USERNAME, password: SN_PASSWORD },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });
  }

  /**
   * Fetch recent resolved incidents for RAG corpus seeding.
   * Returns simplified records: sys_id, number, short_description,
   * close_notes, category, priority.
   */
  async getResolvedIncidents({ limit = 100 } = {}) {
    const response = await this.client.get('/table/incident', {
      params: {
        sysparm_query: 'state=6^ORstate=7', // Resolved or Closed
        sysparm_fields: 'sys_id,number,short_description,close_notes,category,priority',
        sysparm_limit: limit,
        sysparm_display_value: 'true',
      },
    });
    return response.data.result;
  }

  /**
   * Write an AI-generated resolution back to a ServiceNow incident
   * as a work note. Optional — only called if write-back is enabled.
   */
  async addWorkNote(sysId, note) {
    const response = await this.client.patch(`/table/incident/${sysId}`, {
      work_notes: `[AI Triage Copilot]\n${note}`,
    });
    return response.data.result;
  }

  /**
   * Health check — verifies credentials and connectivity.
   */
  async ping() {
    const response = await this.client.get('/table/incident', {
      params: { sysparm_limit: 1, sysparm_fields: 'sys_id' },
    });
    return response.status === 200;
  }
}

module.exports = new SNClient();
