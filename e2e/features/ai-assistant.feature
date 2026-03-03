Feature: AI Assistant

  Scenario: No API key shows onboarding
    Given a game is running with AI mocked
    Then the onboarding panel is visible

  Scenario: Valid API key connects successfully
    Given a game is running with AI mocked
    When I paste a valid API key in onboarding
    Then the onboarding shows success
    And the chat input becomes available

  Scenario: Send message and receive AI response
    Given a game is running with AI mocked
    When I paste a valid API key in onboarding
    And the chat input becomes available
    And I send the AI message "Where am I?"
    Then I see an AI response

  Scenario: Quick hint chips send a message
    Given a game is running with AI mocked
    When I paste a valid API key in onboarding
    And the chat input becomes available
    And I click a quick hint chip
    Then I see an AI response

  Scenario: Clear chat resets to empty state
    Given a game is running with AI mocked
    When I paste a valid API key in onboarding
    And the chat input becomes available
    And I send the AI message "Hello"
    And I see an AI response
    And I clear the chat
    Then the chat is empty
