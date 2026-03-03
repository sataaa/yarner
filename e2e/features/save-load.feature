Feature: Save and Load Game State

  Scenario: Save to a new slot
    Given a game is running
    When I save the game as "test-save-1"
    Then I see save feedback

  Scenario: Save and overwrite the slot
    Given a game is running
    When I save the game as "slot-a"
    And I type the command "look"
    And I overwrite the last save slot
    Then I see save feedback

  Scenario: Load a saved game
    Given a game is running
    When I save the game as "load-test"
    And I type the command "look"
    And I load the slot "load-test"
    Then I see load feedback

  Scenario: Quick-load from library home screen
    Given a game is running
    When I save the game as "quick-save"
    And I close the game
    Then I see the save badge in the library
