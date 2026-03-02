/**
 * Test setup — initializes svelte-i18n with PT-BR locale synchronously
 * so that get(t)(...) calls in tested modules work without errors.
 */
import { register, init } from 'svelte-i18n';
import ptBR from './locales/pt-BR.json';

register('pt-BR', () => Promise.resolve(ptBR));
init({ fallbackLocale: 'pt-BR', initialLocale: 'pt-BR' });
