// Handle API requests
async function getTestCases(testRunId) {
    const auth = btoa("sarah.ramadhanip@flip.id:C7ysebutvZkf2bM");
    const url = `https://flipid.testrail.io/index.php?/api/v2/get_tests/${testRunId}`;
    
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${auth}`
        }
      });
      
      if (!response.ok) throw new Error("Network response was not ok");
      return await response.json();
    } catch (error) {
      console.error("Error fetching test cases:", error);
      return null;
    }
  }
  
  async function updateTestCaseStatus(testRunId, testCaseId, statusId) {
    const auth = btoa("sarah.ramadhanip@flip.id:C7ysebutvZkf2bM");
    const url = `https://flipid.testrail.io/index.php?/api/v2/add_result_for_case/${testRunId}/${testCaseId}`;
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json"
        },
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