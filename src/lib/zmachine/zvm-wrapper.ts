/**
 * ZVM Wrapper - Z-Machine interpreter wrapper for Yarner
 *
 * This wraps the ifvms.js Z-Machine interpreter with a simplified
 * Glk interface for web-based interactive fiction.
 */

import { ZVM } from 'ifvms';

type OutputCallback = (text: string) => void;
type InputCallback = () => Promise<string>;

/**
 * Minimal Glk implementation for web-based Z-Machine interpretation
 */
class WebGlk {
  private outputCallback: OutputCallback;
  private inputCallback: InputCallback;
  private outputBuffer: string[] = [];

  constructor(outputCallback: OutputCallback, inputCallback: InputCallback) {
    this.outputCallback = outputCallback;
    this.inputCallback = inputCallback;
  }

  // Glk structure for event handling
  RefStruct = class {
    private fields: any[] = [];

    push_field(value: any) {
      this.fields.push(value);
    }

    get_field(index: number) {
      return this.fields[index];
    }
  };

  // Glk event selection
  glk_select(event: any) {
    // Request input from user
    this.inputCallback().then(input => {
      event.push_field('line');
      event.push_field(input);
    });
  }

  // Update display
  update() {
    if (this.outputBuffer.length > 0) {
      const text = this.outputBuffer.join('');
      this.outputCallback(text);
      this.outputBuffer = [];
    }
  }

  // Output text to buffer
  glk_put_string(text: string) {
    this.outputBuffer.push(text);
  }

  glk_put_char(char: number) {
    this.outputBuffer.push(String.fromCharCode(char));
  }

  // Error handling
  fatal_error(error: Error | string) {
    console.error('Z-Machine fatal error:', error);
    this.outputCallback(`\n\n[FATAL ERROR: ${error}]\n`);
  }

  // Window management (simplified - single window)
  glk_window_open() {
    return { id: 1 };
  }

  glk_set_window() {
    // No-op for single window
  }

  glk_window_clear() {
    // No-op for now
  }

  // Style management (simplified)
  glk_set_style() {
    // No-op for now - could be extended for rich text
  }
}

/**
 * Game Engine - High-level interface for Z-Machine games
 */
export class GameEngine {
  private vm: any;
  private glk: WebGlk | null = null;
  private outputCallback: OutputCallback = () => {};
  private inputResolver: ((value: string) => void) | null = null;
  private isInitialized = false;

  /**
   * Load a Z-Machine game file
   */
  async loadGame(gameData: ArrayBuffer): Promise<void> {
    try {
      // Create Glk interface
      this.glk = new WebGlk(
        (text) => this.outputCallback(text),
        () => this.waitForInput()
      );

      // Create ZVM instance
      this.vm = Object.create(ZVM);
      this.vm.init();

      // Prepare the VM with story data and Glk reference
      this.vm.prepare(gameData, {
        Glk: this.glk
      });

      // Start the game
      this.vm.start();

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to load game:', error);
      throw new Error(`Failed to load game: ${error}`);
    }
  }

  /**
   * Send a command to the game
   */
  sendCommand(command: string): void {
    if (!this.isInitialized || !this.vm) {
      throw new Error('Game not loaded');
    }

    if (this.inputResolver) {
      this.inputResolver(command);
      this.inputResolver = null;
    }
  }

  /**
   * Register callback for game output
   */
  onOutput(callback: OutputCallback): void {
    this.outputCallback = callback;
  }

  /**
   * Wait for user input (returns a Promise)
   */
  private waitForInput(): Promise<string> {
    return new Promise((resolve) => {
      this.inputResolver = resolve;
    });
  }

  /**
   * Get current game state (for saving)
   */
  getGameState(): any {
    if (!this.vm) return null;
    // TODO: Implement save state serialization
    return {
      initialized: this.isInitialized,
      // Add more state as needed
    };
  }

  /**
   * Check if game is loaded
   */
  isLoaded(): boolean {
    return this.isInitialized;
  }

  /**
   * Restart the game
   */
  restart(): void {
    if (this.vm && this.vm.restart) {
      this.vm.restart();
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.vm = null;
    this.glk = null;
    this.isInitialized = false;
    this.inputResolver = null;
  }
}

/**
 * Convenience function to create a new game engine
 */
export function createGameEngine(): GameEngine {
  return new GameEngine();
}
