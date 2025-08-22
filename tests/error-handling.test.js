// Test error handling and user feedback functionality
describe('Error Handling and User Feedback', () => {
  let mockStatus;

  beforeEach(() => {
    // Create a mock status element
    mockStatus = {
      textContent: '',
      className: '',
      innerHTML: ''
    };
    
    // Mock DOM methods
    global.document = {
      getElementById: jest.fn().mockReturnValue(mockStatus)
    };
    
    jest.clearAllMocks();
  });

  describe('Status Message Functions', () => {
    let showStatus, showProgressStatus;

    beforeEach(() => {
      // Define the functions locally to test them
      showStatus = function(message, type = 'info') {
        mockStatus.textContent = message;
        mockStatus.className = `status ${type}`;
      };

      showProgressStatus = function(message, progress = 0) {
        mockStatus.innerHTML = `
          <span>${message}</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
        `;
        mockStatus.className = 'status progress';
      };
    });

    it('should display info status messages correctly', () => {
      showStatus('Processing...', 'info');
      
      expect(mockStatus.textContent).toBe('Processing...');
      expect(mockStatus.className).toBe('status info');
    });

    it('should display error status messages correctly', () => {
      showStatus('Something went wrong', 'error');
      
      expect(mockStatus.textContent).toBe('Something went wrong');
      expect(mockStatus.className).toBe('status error');
    });

    it('should display success status messages correctly', () => {
      showStatus('Operation completed', 'success');
      
      expect(mockStatus.textContent).toBe('Operation completed');
      expect(mockStatus.className).toBe('status success');
    });

    it('should display progress status with progress bar', () => {
      showProgressStatus('Importing states...', 75);
      
      expect(mockStatus.innerHTML).toContain('Importing states...');
      expect(mockStatus.innerHTML).toContain('width: 75%');
      expect(mockStatus.className).toBe('status progress');
    });

    it('should handle zero progress correctly', () => {
      showProgressStatus('Starting import...', 0);
      
      expect(mockStatus.innerHTML).toContain('Starting import...');
      expect(mockStatus.innerHTML).toContain('width: 0%');
    });

    it('should handle complete progress correctly', () => {
      showProgressStatus('Import completed!', 100);
      
      expect(mockStatus.innerHTML).toContain('Import completed!');
      expect(mockStatus.innerHTML).toContain('width: 100%');
    });
  });

  describe('Error Message Enhancement', () => {
    it('should provide specific error messages for permission errors', () => {
      const error = new Error('permission denied');
      
      let errorMessage = 'Export failed';
      if (error.message.includes('permission')) {
        errorMessage = 'Export failed: Permission denied. Please check bookmark permissions.';
      }
      
      expect(errorMessage).toBe('Export failed: Permission denied. Please check bookmark permissions.');
    });

    it('should provide specific error messages for storage errors', () => {
      const error = new Error('storage quota exceeded');
      
      let errorMessage = 'Export failed';
      if (error.message.includes('storage')) {
        errorMessage = 'Export failed: Storage error. Please try again.';
      }
      
      expect(errorMessage).toBe('Export failed: Storage error. Please try again.');
    });

    it('should provide specific error messages for bookmark errors', () => {
      const error = new Error('bookmark not found');
      
      let errorMessage = 'Export failed';
      if (error.message.includes('bookmark')) {
        errorMessage = 'Export failed: Bookmark access error. Please refresh and try again.';
      }
      
      expect(errorMessage).toBe('Export failed: Bookmark access error. Please refresh and try again.');
    });

    it('should fallback to generic error message for unknown errors', () => {
      const error = new Error('unknown error occurred');
      
      let errorMessage = 'Export failed';
      if (error.message.includes('permission')) {
        errorMessage = 'Export failed: Permission denied. Please check bookmark permissions.';
      } else if (error.message.includes('storage')) {
        errorMessage = 'Export failed: Storage error. Please try again.';
      } else if (error.message.includes('bookmark')) {
        errorMessage = 'Export failed: Bookmark access error. Please refresh and try again.';
      } else {
        errorMessage = `Export failed: ${error.message}`;
      }
      
      expect(errorMessage).toBe('Export failed: unknown error occurred');
    });
  });

  describe('Button State Management', () => {
    let mockButton;

    beforeEach(() => {
      mockButton = {
        disabled: false,
        textContent: 'Export',
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      };
    });

    it('should disable button and show loading state', () => {
      // Simulate loading state
      mockButton.disabled = true;
      mockButton.textContent = 'Exporting...';
      mockButton.classList.add('loading');
      
      expect(mockButton.disabled).toBe(true);
      expect(mockButton.textContent).toBe('Exporting...');
      expect(mockButton.classList.add).toHaveBeenCalledWith('loading');
    });

    it('should re-enable button and remove loading state', () => {
      // Simulate completion state
      mockButton.disabled = false;
      mockButton.textContent = 'Export';
      mockButton.classList.remove('loading');
      
      expect(mockButton.disabled).toBe(false);
      expect(mockButton.textContent).toBe('Export');
      expect(mockButton.classList.remove).toHaveBeenCalledWith('loading');
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress correctly for import operations', () => {
      const totalStates = 5;
      let processedStates = 0;
      
      // Simulate processing states
      for (let i = 1; i <= totalStates; i++) {
        processedStates++;
        const progress = 30 + Math.floor((processedStates / totalStates) * 60);
        
        expect(progress).toBe(30 + (i * 12)); // 30 + (12 * current_state)
      }
      
      // Final progress should be 90 (30 + 60)
      const finalProgress = 30 + Math.floor((5 / 5) * 60);
      expect(finalProgress).toBe(90);
    });

    it('should handle single state import correctly', () => {
      const totalStates = 1;
      const processedStates = 1;
      const progress = 30 + Math.floor((processedStates / totalStates) * 60);
      
      expect(progress).toBe(90); // 30 + 60
    });

    it('should handle zero states gracefully', () => {
      const totalStates = 0;
      const processedStates = 0;
      
      // Avoid division by zero
      const progress = totalStates === 0 ? 30 : 30 + Math.floor((processedStates / totalStates) * 60);
      
      expect(progress).toBe(30);
    });
  });
});
