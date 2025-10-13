import { createLowlight } from 'lowlight';

// languages - keep this the one source of truth
import ts from 'highlight.js/lib/languages/typescript';
import js from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
// New widely-used languages
import csharp from 'highlight.js/lib/languages/csharp';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import scala from 'highlight.js/lib/languages/scala';
import r from 'highlight.js/lib/languages/r';
import perl from 'highlight.js/lib/languages/perl';
import dart from 'highlight.js/lib/languages/dart';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import nginx from 'highlight.js/lib/languages/nginx';
import powershell from 'highlight.js/lib/languages/powershell';
import graphql from 'highlight.js/lib/languages/graphql';
import lua from 'highlight.js/lib/languages/lua';
import makefile from 'highlight.js/lib/languages/makefile';
import diff from 'highlight.js/lib/languages/diff';
import ini from 'highlight.js/lib/languages/ini';
import groovy from 'highlight.js/lib/languages/groovy';
import curl from 'highlight.js/lib/languages/curl';

export const lowlight = (() => {
  const l = createLowlight();

  // TypeScript & JavaScript
  l.register('typescript', ts);
  l.register('ts', ts);
  l.register('tsx', ts);
  l.register('javascript', js);
  l.register('js', js);
  l.register('jsx', js);

  // Data formats
  l.register('json', json);
  l.register('yaml', yaml);
  l.register('yml', yaml);
  l.register('xml', xml);
  l.register('html', xml);
  l.register('ini', ini);
  l.register('toml', ini);

  // Shell/Terminal
  l.register('bash', bash);
  l.register('shell', bash);
  l.register('sh', bash);
  l.register('zsh', bash);
  l.register('powershell', powershell);
  l.register('ps', powershell);
  l.register('ps1', powershell);
  l.register('curl', curl);

  // Styling
  l.register('css', css);

  // Systems & Low-level
  l.register('c', c);
  l.register('cpp', cpp);
  l.register('c++', cpp);
  l.register('rust', rust);
  l.register('rs', rust);
  l.register('go', go);
  l.register('golang', go);

  // JVM Languages
  l.register('java', java);
  l.register('kotlin', kotlin);
  l.register('kt', kotlin);
  l.register('scala', scala);

  // .NET Languages
  l.register('csharp', csharp);
  l.register('cs', csharp);
  l.register('c#', csharp);

  // Scripting Languages
  l.register('python', python);
  l.register('py', python);
  l.register('ruby', ruby);
  l.register('rb', ruby);
  l.register('php', php);
  l.register('perl', perl);
  l.register('pl', perl);
  l.register('lua', lua);

  // Mobile/Modern
  l.register('swift', swift);
  l.register('dart', dart);
  l.register('groovy', groovy);

  // Database
  l.register('sql', sql);

  // Data & Statistics
  l.register('r', r);

  // DevOps & Infrastructure
  l.register('dockerfile', dockerfile);
  l.register('docker', dockerfile);
  l.register('nginx', nginx);
  l.register('nginxconf', nginx);
  l.register('makefile', makefile);
  l.register('make', makefile);

  // Query Languages
  l.register('graphql', graphql);

  // Documentation
  l.register('markdown', markdown);
  l.register('md', markdown);
  l.register('diff', diff);
  l.register('patch', diff);

  return l;
})();
