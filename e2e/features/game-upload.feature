Feature: Game Upload and Play

  Scenario: Upload a valid Z5 game file
    Given I am on the home screen
    When I upload a Z5 game file
    Then the game appears in the library

  Scenario: Start game from library
    Given I have uploaded a game
    When I click the game in the library
    Then the game panel is visible
    And the game output is rendered
    And the command input is focused

  Scenario: Type a command and see output update
    Given a game is running
    When I type the command "look"
    Then the game output updates

  Scenario: Upload duplicate game highlights existing entry
    Given I have uploaded a game
    When I upload the same game file again
    Then the duplicate message is shown

  Scenario: Click game output area focuses input
    Given a game is running
    When I click the game output area
    Then the command input is focused

  Scenario: Bundled game is present without any upload
    Given I am on the home screen
    Then the bundled game appears in the library
    And the bundled game has no remove button
