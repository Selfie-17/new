import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Square } from 'lucide-react';

// Emoji map for common GitHub shortcodes
const emojiMap = {
    ':smile:': '😄', ':grinning:': '😀', ':laughing:': '😆', ':joy:': '😂',
    ':heart:': '❤️', ':heart_eyes:': '😍', ':fire:': '🔥', ':rocket:': '🚀',
    ':thumbsup:': '👍', ':thumbsdown:': '👎', ':clap:': '👏', ':wave:': '👋',
    ':star:': '⭐', ':sparkles:': '✨', ':zap:': '⚡', ':bulb:': '💡',
    ':warning:': '⚠️', ':x:': '❌', ':white_check_mark:': '✅', ':checkered_flag:': '🏁',
    ':bug:': '🐛', ':memo:': '📝', ':bookmark:': '🔖', ':link:': '🔗',
    ':lock:': '🔒', ':unlock:': '🔓', ':key:': '🔑', ':mag:': '🔍',
    ':wrench:': '🔧', ':hammer:': '🔨', ':gear:': '⚙️', ':package:': '📦',
    ':tada:': '🎉', ':confetti_ball:': '🎊', ':balloon:': '🎈', ':gift:': '🎁',
    ':trophy:': '🏆', ':medal:': '🏅', ':1st_place_medal:': '🥇', ':100:': '💯',
    ':heavy_plus_sign:': '➕', ':heavy_minus_sign:': '➖', ':heavy_check_mark:': '✔️',
    ':arrow_right:': '➡️', ':arrow_left:': '⬅️', ':arrow_up:': '⬆️', ':arrow_down:': '⬇️',
    ':information_source:': 'ℹ️', ':question:': '❓', ':exclamation:': '❗',
    ':speech_balloon:': '💬', ':thought_balloon:': '💭', ':eyes:': '👀',
    ':octocat:': '🐙', ':shipit:': '🐿️', ':penguin:': '🐧', ':cat:': '🐱', ':dog:': '🐶',
    ':coffee:': '☕', ':beer:': '🍺', ':pizza:': '🍕', ':apple:': '🍎',
    ':sunny:': '☀️', ':cloud:': '☁️', ':umbrella:': '☔', ':snowflake:': '❄️',
    ':earth_americas:': '🌎', ':globe_with_meridians:': '🌐', ':world_map:': '🗺️',
    ':books:': '📚', ':book:': '📖', ':notebook:': '📓', ':page_facing_up:': '📄',
    ':clipboard:': '📋', ':calendar:': '📅', ':chart_with_upwards_trend:': '📈',
    ':computer:': '💻', ':desktop_computer:': '🖥️', ':keyboard:': '⌨️', ':mouse:': '🖱️',
    ':iphone:': '📱', ':telephone:': '📞', ':email:': '📧', ':inbox_tray:': '📥',
    ':outbox_tray:': '📤', ':pushpin:': '📌', ':paperclip:': '📎', ':scissors:': '✂️',
    ':file_folder:': '📁', ':open_file_folder:': '📂', ':card_file_box:': '🗃️',
    ':wastebasket:': '🗑️', ':pencil:': '✏️', ':pencil2:': '✏️', ':pen:': '🖊️',
    ':construction:': '🚧', ':rotating_light:': '🚨', ':bell:': '🔔', ':no_bell:': '🔕',
    ':musical_note:': '🎵', ':headphones:': '🎧', ':microphone:': '🎤', ':movie_camera:': '🎥',
    ':video_camera:': '📹', ':camera:': '📷', ':mag_right:': '🔎', ':telescope:': '🔭',
    ':microscope:': '🔬', ':syringe:': '💉', ':pill:': '💊', ':dna:': '🧬',
    ':atom_symbol:': '⚛️', ':infinity:': '♾️', ':recycle:': '♻️', ':trident:': '🔱',
    ':beginner:': '🔰', ':o:': '⭕', ':negative_squared_cross_mark:': '❎',
    ':red_circle:': '🔴', ':orange_circle:': '🟠', ':yellow_circle:': '🟡',
    ':green_circle:': '🟢', ':blue_circle:': '🔵', ':purple_circle:': '🟣',
    ':black_circle:': '⚫', ':white_circle:': '⚪', ':large_blue_diamond:': '🔷',
    ':small_blue_diamond:': '🔹', ':large_orange_diamond:': '🔶', ':small_orange_diamond:': '🔸',
};

// Replace emoji shortcodes with actual emojis
const replaceEmojis = (text) => {
    if (typeof text !== 'string') return text;
    return text.replace(/:[a-zA-Z0-9_+-]+:/g, (match) => emojiMap[match] || match);
};

// Replace @mentions and #issues with styled spans
const processGitHubFeatures = (text) => {
    if (typeof text !== 'string') return text;

    // Replace emojis first
    let processed = replaceEmojis(text);

    return processed;
};

// Custom components for ReactMarkdown
const customComponents = {
    // Code blocks with syntax highlighting
    code({ node, inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        const language = match ? match[1] : '';
        const codeContent = String(children).replace(/\n$/, '');

        // Check if this is inline code
        // In newer react-markdown versions, inline might be undefined
        // We can detect inline by checking if parent is not 'pre' or by checking node properties
        const isInline = inline === true || inline === undefined && !className && codeContent.indexOf('\n') === -1;

        // Inline code (single backticks like `hi`)
        if (isInline) {
            return (
                <code
                    className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded font-mono"
                    style={{ fontSize: '0.9em' }}
                    {...props}
                >
                    {children}
                </code>
            );
        }

        // Code block with language specified
        if (language) {
            return (
                <SyntaxHighlighter
                    style={oneDark}
                    language={language}
                    PreTag="div"
                    className="rounded-lg my-4 text-sm"
                    showLineNumbers={true}
                    {...props}
                >
                    {codeContent}
                </SyntaxHighlighter>
            );
        }

        // Code block without language (fenced but no language)
        return (
            <SyntaxHighlighter
                style={oneDark}
                language="text"
                PreTag="div"
                className="rounded-lg my-4 text-sm"
                {...props}
            >
                {codeContent}
            </SyntaxHighlighter>
        );
    },

    // Headings with anchor links
    h1({ children, ...props }) {
        const id = String(children).toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return (
            <h1 id={id} className="text-3xl font-bold mb-4 mt-8 pb-2 border-b border-gray-200 group" {...props}>
                <a href={`#${id}`} className="hover:text-blue-600">{processGitHubFeatures(children)}</a>
            </h1>
        );
    },
    h2({ children, ...props }) {
        const id = String(children).toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return (
            <h2 id={id} className="text-2xl font-bold mb-3 mt-6 pb-2 border-b border-gray-100" {...props}>
                <a href={`#${id}`} className="hover:text-blue-600">{processGitHubFeatures(children)}</a>
            </h2>
        );
    },
    h3({ children, ...props }) {
        const id = String(children).toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return (
            <h3 id={id} className="text-xl font-bold mb-2 mt-5" {...props}>
                {processGitHubFeatures(children)}
            </h3>
        );
    },
    h4({ children, ...props }) {
        return <h4 className="text-lg font-bold mb-2 mt-4" {...props}>{processGitHubFeatures(children)}</h4>;
    },
    h5({ children, ...props }) {
        return <h5 className="text-base font-bold mb-1 mt-3" {...props}>{processGitHubFeatures(children)}</h5>;
    },
    h6({ children, ...props }) {
        return <h6 className="text-sm font-bold mb-1 mt-3 text-gray-600" {...props}>{processGitHubFeatures(children)}</h6>;
    },

    // Paragraphs with emoji support
    p({ children, ...props }) {
        return (
            <p className="mb-4 leading-relaxed text-gray-800" {...props}>
                {typeof children === 'string' ? processGitHubFeatures(children) : children}
            </p>
        );
    },

    // Blockquotes
    blockquote({ children, ...props }) {
        return (
            <blockquote className="border-l-4 border-blue-500 bg-blue-50 pl-4 pr-4 py-2 my-4 text-gray-700 italic rounded-r" {...props}>
                {children}
            </blockquote>
        );
    },

    // Links
    a({ href, children, ...props }) {
        const isExternal = href?.startsWith('http');
        return (
            <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="text-blue-600 hover:text-blue-800 hover:underline"
                {...props}
            >
                {children}
                {isExternal && <span className="text-xs ml-1">↗</span>}
            </a>
        );
    },

    // Images
    img({ src, alt, title, ...props }) {
        return (
            <span className="block my-4">
                <img
                    src={src}
                    alt={alt || ''}
                    title={title}
                    className="max-w-full h-auto rounded-lg shadow-sm border border-gray-200"
                    loading="lazy"
                    {...props}
                />
                {alt && <span className="block text-center text-sm text-gray-500 mt-2">{alt}</span>}
            </span>
        );
    },

    // Tables
    table({ children, ...props }) {
        return (
            <div className="overflow-x-auto my-4">
                <table className="min-w-full border-collapse border border-gray-300 rounded-lg" {...props}>
                    {children}
                </table>
            </div>
        );
    },
    thead({ children, ...props }) {
        return <thead className="bg-gray-50" {...props}>{children}</thead>;
    },
    th({ children, style, ...props }) {
        return (
            <th
                className="border border-gray-300 px-4 py-2 font-semibold text-left text-gray-700"
                style={style}
                {...props}
            >
                {children}
            </th>
        );
    },
    td({ children, style, ...props }) {
        return (
            <td
                className="border border-gray-300 px-4 py-2 text-gray-600"
                style={style}
                {...props}
            >
                {children}
            </td>
        );
    },
    tr({ children, ...props }) {
        return <tr className="hover:bg-gray-50" {...props}>{children}</tr>;
    },

    // Lists
    ul({ children, className, ...props }) {
        // Check if this is a task list
        const isTaskList = className?.includes('contains-task-list');
        return (
            <ul className={`mb-4 ${isTaskList ? 'list-none pl-0' : 'list-disc pl-6'}`} {...props}>
                {children}
            </ul>
        );
    },
    ol({ children, ...props }) {
        return <ol className="list-decimal pl-6 mb-4" {...props}>{children}</ol>;
    },
    li({ children, className, ...props }) {
        // Check if this is a task list item
        const isTaskItem = className?.includes('task-list-item');

        if (isTaskItem) {
            return (
                <li className="flex items-start gap-2 mb-1 list-none" {...props}>
                    {children}
                </li>
            );
        }

        return <li className="mb-1" {...props}>{children}</li>;
    },

    // Task list checkboxes
    input({ type, checked, ...props }) {
        if (type === 'checkbox') {
            return (
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded border ${checked
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-400 bg-white'
                    } mr-2 mt-0.5 flex-shrink-0`}>
                    {checked && <Check className="w-3 h-3" />}
                </span>
            );
        }
        return <input type={type} {...props} />;
    },

    // Horizontal rule
    hr({ ...props }) {
        return <hr className="my-8 border-t-2 border-gray-200" {...props} />;
    },

    // Strikethrough
    del({ children, ...props }) {
        return <del className="text-gray-500 line-through" {...props}>{children}</del>;
    },

    // Strong/Bold
    strong({ children, ...props }) {
        return <strong className="font-bold text-gray-900" {...props}>{children}</strong>;
    },

    // Emphasis/Italic
    em({ children, ...props }) {
        return <em className="italic" {...props}>{children}</em>;
    },

    // Pre (wrapper for code blocks)
    pre({ children, ...props }) {
        return <div className="my-4" {...props}>{children}</div>;
    },
};

export default function MarkdownRenderer({ content, className = '' }) {
    // Pre-process content for GitHub-specific features
    // Note: We intentionally do NOT process @mentions automatically as it can break:
    // - Code blocks with SQL variables (@var)
    // - Email addresses (user@domain.com)
    // - Other @ symbols in technical content
    const processedContent = content
        // Handle #issue references (standalone numbers after #)
        ?.replace(/(^|[\s\(])#(\d+)(?=[\s\.,;:\)\]!?]|$)/gm, '$1[#$2](#issue-$2)')
        // Handle user/repo#issue
        ?.replace(/(\w+\/\w+)#(\d+)/g, '[$1#$2](#repo-issue-$1-$2)');

    return (
        <div className={`markdown-preview prose prose-gray max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeRaw]}
                components={customComponents}
            >
                {processedContent || ''}
            </ReactMarkdown>
        </div>
    );
}
