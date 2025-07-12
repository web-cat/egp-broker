const axios = require('axios');

class CanvasService {
  constructor(baseUrl = process.env.CANVAS_URL || 'https://canvas.endeavour.cs.vt.edu') {
    this.baseUrl = baseUrl;
  }

  // Helper function to handle pagination by following Link headers
  async getAllPages(url, apiKey, maxPages = 100) {
    const allResults = [];
    let currentUrl = url;
    let pageCount = 0;

    while (currentUrl && pageCount < maxPages) {
      try {
        console.log(`Fetching page ${pageCount + 1}: ${currentUrl}`);
        
        const response = await axios.get(currentUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        // Add current page results
        if (Array.isArray(response.data)) {
          allResults.push(...response.data);
        } else {
          allResults.push(response.data);
        }

        // Check for next page in Link header
        const linkHeader = response.headers.link;
        if (!linkHeader) {
          console.log('No Link header found, assuming single page');
          break;
        }

        // Parse Link header to find next page
        const nextLink = this.parseLinkHeader(linkHeader, 'next');
        if (!nextLink) {
          console.log('No next page found in Link header');
          break;
        }

        currentUrl = nextLink;
        pageCount++;
        
        console.log(`Page ${pageCount} complete. Total items so far: ${allResults.length}`);
        
      } catch (error) {
        console.error(`Error fetching page ${pageCount + 1}:`, error.response?.data || error.message);
        break;
      }
    }

    console.log(`Pagination complete. Total pages: ${pageCount + 1}, Total items: ${allResults.length}`);
    return allResults;
  }

  // Parse Link header to extract specific relation
  parseLinkHeader(linkHeader, relation) {
    if (!linkHeader) return null;
    
    const links = linkHeader.split(',').map(link => {
      const [url, rel] = link.split(';').map(part => part.trim());
      const urlMatch = url.match(/<(.+)>/);
      const relMatch = rel.match(/rel="(.+)"/);
      
      if (urlMatch && relMatch) {
        return {
          url: urlMatch[1],
          relation: relMatch[1]
        };
      }
      return null;
    }).filter(Boolean);

    const nextLink = links.find(link => link.relation === relation);
    return nextLink ? nextLink.url : null;
  }

  // Fetch assignments for a course using instructor's API key
  async getCourseAssignments(courseCanvasId, apiKey) {
    try {
      // First, get all assignment groups with pagination
      const groupsUrl = `${this.baseUrl}/api/v1/courses/${courseCanvasId}/assignment_groups`;
      const assignmentGroups = await this.getAllPages(groupsUrl, apiKey);
      
      console.log(`Found ${assignmentGroups.length} assignment groups`);
      
      // Fetch assignments from each group with pagination
      const allAssignments = [];
      
      for (const group of assignmentGroups) {
        try {
          const assignmentsUrl = `${this.baseUrl}/api/v1/courses/${courseCanvasId}/assignment_groups/${group.id}/assignments`;
          const groupAssignments = await this.getAllPages(assignmentsUrl, apiKey);
          
          console.log(`Group "${group.name}" has ${groupAssignments.length} assignments`);
          
          // Add group information to each assignment
          const assignmentsWithGroup = groupAssignments.map(assignment => ({
            ...assignment,
            assignment_group_name: group.name,
            assignment_group_id: group.id
          }));
          
          allAssignments.push(...assignmentsWithGroup);
        } catch (groupError) {
          console.error(`Error fetching assignments for group ${group.id}:`, groupError.response?.data || groupError.message);
          // Continue with other groups even if one fails
        }
      }
      
      console.log(`Total assignments fetched: ${allAssignments.length}`);
      return allAssignments;
    } catch (error) {
      console.error('Error fetching course assignments:', error.response?.data || error.message);
      throw new Error(`Failed to fetch assignments: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // Fetch assignments for a specific student in a course
  async getStudentAssignments(courseCanvasId, studentCanvasId, apiKey) {
    try {
      const url = `${this.baseUrl}/api/v1/users/${studentCanvasId}/courses/${courseCanvasId}/assignments`;
      return await this.getAllPages(url, apiKey);
    } catch (error) {
      console.error('Error fetching student assignments:', error.response?.data || error.message);
      throw new Error(`Failed to fetch student assignments: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // Update assignment due date for a specific student
  async updateStudentAssignmentDueDate(courseCanvasId, assignmentCanvasId, studentCanvasId, newDueDate, apiKey) {
    try {
      const response = await axios.put(
        `${this.baseUrl}/api/v1/courses/${courseCanvasId}/assignments/${assignmentCanvasId}/overrides`,
        {
          assignment_override: {
            student_ids: [studentCanvasId],
            due_at: newDueDate
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating assignment due date:', error.response?.data || error.message);
      throw new Error(`Failed to update due date: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // Get assignment overrides for a specific student
  async getAssignmentOverrides(courseCanvasId, assignmentCanvasId, apiKey) {
    try {
      const url = `${this.baseUrl}/api/v1/courses/${courseCanvasId}/assignments/${assignmentCanvasId}/overrides`;
      return await this.getAllPages(url, apiKey);
    } catch (error) {
      console.error('Error fetching assignment overrides:', error.response?.data || error.message);
      throw new Error(`Failed to fetch overrides: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }
}

module.exports = CanvasService; 