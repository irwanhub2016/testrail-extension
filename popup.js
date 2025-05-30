// popup.js
document.addEventListener('DOMContentLoaded', () => {
    // Online/offline status tracking
    let isOnline = navigator.onLine;
    window.addEventListener('online', () => {
      isOnline = true;
      showConnectionStatus('Online', true);
      syncPendingUpdates();
    });
    window.addEventListener('offline', () => {
      isOnline = false;
      showConnectionStatus('Offline', false);
    });
    // DOM elements
    const testrailUrlInput = document.getElementById('testrail-url');
    const authTokenInput = document.getElementById('auth-token');
    const saveAuthButton = document.getElementById('save-auth');
    const authStatusDiv = document.getElementById('auth-status');
    const testRunIdInput = document.getElementById('test-run-id');
    const fetchTestsButton = document.getElementById('fetch-tests');
    const loadingDiv = document.getElementById('loading');
    const errorMessageDiv = document.getElementById('error-message');
    const testCasesContainer = document.getElementById('test-cases-container');
    const connectionStatusDiv = document.getElementById('connection-status');
    const syncBannerDiv = document.getElementById('sync-banner');
    const pendingCountSpan = document.getElementById('pending-count');
    const syncNowBtn = document.getElementById('sync-now-btn');
    const testRunStatsDiv = document.getElementById('test-run-stats');
    const statsContainerDiv = document.getElementById('stats-container');
  
    // Load saved credentials and show connection status
    chrome.storage.local.get(['testrailUrl', 'authToken', 'testRunId', 'pendingUpdates'], (result) => {
      if (result.testrailUrl) testrailUrlInput.value = result.testrailUrl;
      if (result.authToken) authTokenInput.value = result.authToken;
      if (result.testRunId) testRunIdInput.value = result.testRunId;
      
      // Initialize connection status
      showConnectionStatus(isOnline ? 'Online' : 'Offline', isOnline);
      
      // Check for pending updates
      const pendingUpdates = result.pendingUpdates || [];
      updatePendingBanner(pendingUpdates.length);
    });
  
    // Save credentials
    saveAuthButton.addEventListener('click', () => {
      const testrailUrl = testrailUrlInput.value.trim();
      const authToken = authTokenInput.value.trim();
      
      if (!testrailUrl || !authToken) {
        authStatusDiv.textContent = 'Please provide both TestRail URL and Auth Token';
        authStatusDiv.className = 'error';
        return;
      }
  
      chrome.storage.local.set({
        testrailUrl: testrailUrl,
        authToken: authToken
      }, () => {
        authStatusDiv.textContent = 'Credentials saved successfully!';
        authStatusDiv.className = 'success-message';
        setTimeout(() => {
          authStatusDiv.textContent = '';
        }, 3000);
      });
    });
  
    // Fetch test cases
    fetchTestsButton.addEventListener('click', async () => {
      const testRunId = testRunIdInput.value.trim();
      
      if (!testRunId) {
        showError('Please enter a Test Run ID');
        return;
      }
  
      // Save the test run ID
      chrome.storage.local.set({ testRunId: testRunId });
  
      // Get credentials from storage
      chrome.storage.local.get(['testrailUrl', 'authToken'], async (result) => {
        if (!result.testrailUrl || !result.authToken) {
          showError('Please save your TestRail credentials first');
          return;
        }
  
        try {
          // First fetch the test run details to get statistics
          await fetchAndDisplayTestRunStats(result.testrailUrl, result.authToken, testRunId);
          
          // Then fetch and display test cases
          await fetchAndDisplayTestCases(result.testrailUrl, result.authToken, testRunId);
        } catch (error) {
          showError(`Error: ${error.message}`);
        }
      });
    });
    
    // New function to fetch and display test run statistics
    async function fetchAndDisplayTestRunStats(testrailUrl, authToken, testRunId) {
      showLoading(true);
      hideError();
      
      try {
        const url = `${testrailUrl}/index.php?/api/v2/get_run/${testRunId}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authToken}`
          }
        });
  
        if (!response.ok) {
          throw new Error(`API responded with status ${response.status}`);
        }
  
        const data = await response.json();
        displayTestRunStats(data);
      } catch (error) {
        showError(`Failed to fetch test run statistics: ${error.message}`);
        testRunStatsDiv.classList.add('hidden');
      }
    }
    
    // Function to display test run statistics
    function displayTestRunStats(testRun) {
      // Calculate total tests
      const totalTests = testRun.passed_count + testRun.failed_count + 
                         testRun.blocked_count + testRun.untested_count + 
                         testRun.retest_count;
      
      if (totalTests === 0) {
        testRunStatsDiv.classList.add('hidden');
        return;
      }
      
      // Calculate percentages
      const passPercentage = Math.round((testRun.passed_count / totalTests) * 100) || 0;
      const failPercentage = Math.round((testRun.failed_count / totalTests) * 100) || 0;
      const otherPercentage = 100 - passPercentage - failPercentage;
      
      // Create stats HTML
      statsContainerDiv.innerHTML = `
        <div class="test-stats">
          <div class="stats-title">${testRun.name}</div>
          <div class="stats-container">
            <div class="stat-item">
              <div class="stat-value stat-pass">${passPercentage}%</div>
              <div class="stat-label">Passed (${testRun.passed_count})</div>
            </div>
            <div class="stat-item">
              <div class="stat-value stat-fail">${failPercentage}%</div>
              <div class="stat-label">Failed (${testRun.failed_count})</div>
            </div>
            <div class="stat-item">
              <div class="stat-value stat-other">${otherPercentage}%</div>
              <div class="stat-label">Other (${testRun.blocked_count + testRun.untested_count + testRun.retest_count})</div>
            </div>
          </div>
        </div>
      `;
      
      // Show the stats section
      testRunStatsDiv.classList.remove('hidden');
    }
  
    // Fetch and display test cases
    async function fetchAndDisplayTestCases(testrailUrl, authToken, testRunId) {
      showLoading(true);
      clearTestCasesContainer();
      hideError();
  
      try {
        const url = `${testrailUrl}/index.php?/api/v2/get_tests/${testRunId}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authToken}`
          }
        });
  
        if (!response.ok) {
          throw new Error(`API responded with status ${response.status}`);
        }
  
        const data = await response.json();
        displayTestCases(data.tests, testrailUrl, authToken, testRunId);
      } catch (error) {
        showError(`Failed to fetch test cases: ${error.message}`);
      } finally {
        showLoading(false);
      }
    }
  
    // Display test cases
    function displayTestCases(tests, testrailUrl, authToken, testRunId) {
      if (!tests || tests.length === 0) {
        testCasesContainer.innerHTML = '<p>No test cases found in this test run.</p>';
        return;
      }
  
      tests.forEach(test => {
        const testCaseElement = createTestCaseElement(test);
        
        // Add status update buttons
        const statusButtonsDiv = document.createElement('div');
        statusButtonsDiv.className = 'status-actions';
        
        // Pass button
        const passButton = createStatusButton('Pass', 'status-pass', 1);
        
        // Fail button
        const failButton = createStatusButton('Fail', 'status-fail', 5);
        
        // Block button
        const blockButton = createStatusButton('Block', 'status-block', 2);
        
        // Add event listeners to buttons
        [passButton, failButton, blockButton].forEach(button => {
          button.addEventListener('click', async () => {
            const statusId = parseInt(button.dataset.statusId);
            await updateTestCaseStatus(testrailUrl, authToken, testRunId, test.case_id, statusId, button);
          });
        });
        
        // Add buttons to container
        statusButtonsDiv.appendChild(passButton);
        statusButtonsDiv.appendChild(failButton);
        statusButtonsDiv.appendChild(blockButton);
        
        // Add toggle details button
        const detailsSection = testCaseElement.querySelector('.test-case-details');
        const toggleButton = document.createElement('button');
        toggleButton.className = 'toggle-details';
        toggleButton.textContent = 'Show Details';
        toggleButton.addEventListener('click', () => {
          if (detailsSection.style.display === 'none' || !detailsSection.style.display) {
            detailsSection.style.display = 'block';
            toggleButton.textContent = 'Hide Details';
          } else {
            detailsSection.style.display = 'none';
            toggleButton.textContent = 'Show Details';
          }
        });
        
        // Find the header to add the toggle button
        const headerDiv = testCaseElement.querySelector('.test-case-header');
        headerDiv.appendChild(toggleButton);
        
        // Hide details by default
        detailsSection.style.display = 'none';
        
        testCaseElement.appendChild(statusButtonsDiv);
        testCasesContainer.appendChild(testCaseElement);
      });
    }
  
    // Create a test case element
    function createTestCaseElement(test) {
      const testCaseDiv = document.createElement('div');
      testCaseDiv.className = 'test-case';
      testCaseDiv.dataset.testId = test.id;
      testCaseDiv.dataset.caseId = test.case_id;
      
      // Add test case header
      const headerDiv = document.createElement('div');
      headerDiv.className = 'test-case-header';
      
      // Add test ID
      const idSpan = document.createElement('span');
      idSpan.className = 'test-case-id';
      idSpan.textContent = `ID: ${test.case_id}`;
      
      // Add test title
      const titleSpan = document.createElement('span');
      titleSpan.className = 'test-case-title';
      titleSpan.textContent = test.title;
      
      headerDiv.appendChild(idSpan);
      headerDiv.appendChild(titleSpan);
      
      testCaseDiv.appendChild(headerDiv);
      
      // Add test details section
      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'test-case-details';
      
      // Add preconditions if available
      if (test.custom_preconds) {
        addDetailSection(detailsDiv, 'Preconditions', test.custom_preconds);
      }
      
      // Add steps if available
      if (test.custom_steps) {
        addDetailSection(detailsDiv, 'Steps', test.custom_steps);
      }
      
      // Add expected results if available
      if (test.custom_expected) {
        addDetailSection(detailsDiv, 'Expected Results', test.custom_expected);
      }
      
      testCaseDiv.appendChild(detailsDiv);
      
      return testCaseDiv;
    }
  
    // Add a section to test case details
    function addDetailSection(container, title, content) {
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'test-case-section';
      
      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'test-case-section-title';
      sectionTitle.textContent = title;
      
      const sectionContent = document.createElement('div');
      sectionContent.innerHTML = content.replace(/\r\n/g, '<br>');
      
      sectionDiv.appendChild(sectionTitle);
      sectionDiv.appendChild(sectionContent);
      
      container.appendChild(sectionDiv);
    }
  
    // Create a status update button
    function createStatusButton(text, className, statusId) {
      const button = document.createElement('button');
      button.className = `status-btn ${className}`;
      button.textContent = text;
      button.dataset.statusId = statusId;
      return button;
    }
  
    // Update test case status with offline support
    async function updateTestCaseStatus(testrailUrl, authToken, testRunId, caseId, statusId, button) {
      const originalText = button.textContent;
      button.textContent = 'Updating...';
      button.disabled = true;
      
      const updateData = {
        testrailUrl,
        authToken,
        testRunId,
        caseId,
        statusId,
        timestamp: new Date().getTime()
      };
      
      // If online, try to update immediately
      if (isOnline) {
        try {
          await sendUpdateToTestrail(updateData);
          
          // Show success message
          const testCaseElement = button.closest('.test-case');
          showSuccessMessage(testCaseElement, 'Status updated successfully!');
        } catch (error) {
          // If update fails, store for later sync
          await addToPendingUpdates(updateData);
          showError(`Update failed, saved for later sync: ${error.message}`);
        }
      } else {
        // If offline, add to pending updates
        await addToPendingUpdates(updateData);
        
        // Show offline notification
        const testCaseElement = button.closest('.test-case');
        showSuccessMessage(testCaseElement, 'Update saved for sync when online');
      }
      
      button.textContent = originalText;
      button.disabled = false;
    }
    
    // Send update to TestRail API
    async function sendUpdateToTestrail(updateData) {
      const url = `${updateData.testrailUrl}/index.php?/api/v2/add_result_for_case/${updateData.testRunId}/${updateData.caseId}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${updateData.authToken}`
        },
        body: JSON.stringify({
          status_id: updateData.statusId
        })
      });
  
      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }
      
      return response.json();
    }
    
    // Add update to pending queue
    async function addToPendingUpdates(updateData) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['pendingUpdates'], (result) => {
          const pendingUpdates = result.pendingUpdates || [];
          pendingUpdates.push(updateData);
          
          chrome.storage.local.set({ pendingUpdates }, () => {
            updatePendingBanner(pendingUpdates.length);
            resolve();
          });
        });
      });
    }
    
    // Update pending updates banner
    function updatePendingBanner(count) {
      if (count > 0) {
        pendingCountSpan.textContent = count;
        syncBannerDiv.classList.remove('hidden');
      } else {
        syncBannerDiv.classList.add('hidden');
      }
    }
    
    // Show success message
    function showSuccessMessage(container, message) {
      const successMessage = document.createElement('div');
      successMessage.className = 'success-message';
      successMessage.textContent = message;
      
      // Remove existing success messages if any
      const existingMessages = container.querySelectorAll('.success-message');
      existingMessages.forEach(msg => msg.remove());
      
      container.appendChild(successMessage);
      
      // Remove success message after 3 seconds
      setTimeout(() => {
        successMessage.remove();
      }, 3000);
    }
    
    // Show connection status
    function showConnectionStatus(status, isOnline) {
      connectionStatusDiv.textContent = status;
      if (isOnline) {
        connectionStatusDiv.classList.remove('offline');
      } else {
        connectionStatusDiv.classList.add('offline');
      }
    }
  
    // Helper functions
    function showLoading(show) {
      loadingDiv.className = show ? '' : 'hidden';
    }
  
    function showError(message) {
      errorMessageDiv.textContent = message;
      errorMessageDiv.className = 'error';
    }
  
    function hideError() {
      errorMessageDiv.className = 'hidden';
      errorMessageDiv.textContent = '';
    }
  
    function clearTestCasesContainer() {
      testCasesContainer.innerHTML = '';
    }
    
    // Sync pending updates with TestRail
    async function syncPendingUpdates() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['pendingUpdates'], async (result) => {
          const pendingUpdates = result.pendingUpdates || [];
          
          if (pendingUpdates.length === 0) {
            resolve();
            return;
          }
          
          let successCount = 0;
          let remainingUpdates = [];
          
          for (const update of pendingUpdates) {
            try {
              await sendUpdateToTestrail(update);
              successCount++;
            } catch (error) {
              console.error('Failed to sync update:', error);
              remainingUpdates.push(update);
            }
          }
          
          // Save remaining updates
          chrome.storage.local.set({ pendingUpdates: remainingUpdates }, () => {
            updatePendingBanner(remainingUpdates.length);
            
            if (successCount > 0) {
              showError(`Successfully synced ${successCount} updates. ${remainingUpdates.length} remaining.`);
              setTimeout(hideError, 3000);
            }
            
            resolve();
          });
        });
      });
    }
    
    // Setup sync button
    syncNowBtn.addEventListener('click', () => {
      if (isOnline) {
        syncNowBtn.textContent = 'Syncing...';
        syncNowBtn.disabled = true;
        
        syncPendingUpdates().then(() => {
          syncNowBtn.textContent = 'Sync Now';
          syncNowBtn.disabled = false;
        });
      } else {
        showError('Cannot sync while offline. Please connect to the internet first.');
      }
    });
  });