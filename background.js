// Handle API requests
async function getTestCases(testRunId) {
    const storage = await chrome.storage.local.get(['testrailUrl', 'authToken']);
    if (!storage.testrailUrl || !storage.authToken) {
        throw new Error("TestRail URL and auth token must be configured");
    }
    
    const url = `${storage.testrailUrl}/index.php?/api/v2/get_tests/${testRunId}`;
    
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${storage.authToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        mode: "no-cors"
      });
      
      if (!response.ok) throw new Error("Network response was not ok");
      return await response.json();
    } catch (error) {
      console.error("Error fetching test cases:", error);
      return null;
    }
  }
  
  async function updateTestCaseStatus(testRunId, testCaseId, statusId) {
    const storage = await chrome.storage.local.get(['testrailUrl', 'authToken']);
    if (!storage.testrailUrl || !storage.authToken) {
        throw new Error("TestRail URL and auth token must be configured");
    }
    
    const url = `${storage.testrailUrl}/index.php?/api/v2/add_result_for_case/${testRunId}/${testCaseId}`;    

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${storage.authToken}`,
          "Content-Type": "application/json",
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        mode: "no-cors",
        body: JSON.stringify({ status_id: statusId })
      });
      
      if (!response.ok) throw new Error("Failed to update status");
      return await response.json();
    } catch (error) {
      console.error("Error updating status:", error);
      return null;
    }
  }
  
  // Message handler
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getTestCases") {
      getTestCases(request.testRunId).then(tests => {
        sendResponse({ tests });
      });
    } else if (request.action === "updateStatus") {
      updateTestCaseStatus(request.testRunId, request.testCaseId, request.statusId).then(result => {
        sendResponse({ result });
      });
    }
    return true; // Indicates async response
  });