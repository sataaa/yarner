Feature: Settings — Theme, Locale, Clear Data

  Scenario: Cycle through themes
    Given I am on the home screen
    When I click the theme button 4 times
    Then each click changes the data-theme attribute

  Scenario: Theme persists after reload
    Given I am on the home screen
    When I click the theme button once
    And I reload the page
    Then the theme is still changed

  Scenario: Locale switch changes UI text
    Given I am on the home screen
    When I click the locale button
    Then the UI text language changes

  Scenario: Locale persists after reload
    Given I am on the home screen
    When I click the locale button
    And I reload the page
    Then the locale is still changed

  Scenario: Clear all data removes user-added games
    Given I have uploaded a game
    When I clear all data
    Then only the bundled game remains
