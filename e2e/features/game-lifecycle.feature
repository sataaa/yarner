Feature: Game Lifecycle — Restart and Close

  Scenario: Restart game resets output
    Given a game is running
    When I type the command "look"
    And I restart the game
    Then the game output is reset to initial state

  Scenario: Cancel restart continues game
    Given a game is running
    When I type the command "look"
    And I click restart and cancel
    Then the game panel is still visible

  Scenario: Close game returns to home screen
    Given a game is running
    When I close the game and confirm
    Then I am back on the home screen
    And the game is still in the library

  Scenario: Close and reopen starts fresh
    Given a game is running
    When I type the command "look"
    And I close the game and confirm
    And I click the game in the library again
    Then the game output is reset to initial state
