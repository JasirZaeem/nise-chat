import {
    ArrowLeft,
    Brain,
    BrainCog,
    ChevronsUpDown,
    Expand,
    Eye,
    FileIcon,
    Globe,
    LucideX,
    Paperclip,
    RefreshCcw,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {Popover, PopoverContent, PopoverTrigger,} from "@/components/ui/popover";
import {
    type ChangeEvent,
    type CSSProperties,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
    useState,
} from "react";
import {Tooltip, TooltipContent, TooltipTrigger,} from "@/components/ui/tooltip.tsx";
import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSub,
    MenubarSubContent,
    MenubarSubTrigger,
    MenubarTrigger,
} from "@/components/ui/menubar.tsx";
import type {ModelReasoningEffort, ResponseModel} from "@/lib/api.ts";
import {Select, SelectContent, SelectItem, SelectValue,} from "@/components/ui/select.tsx";
import * as SelectPrimitive from "@radix-ui/react-select";
import {Badge} from "@/components/ui/badge.tsx";

const modelFeatures = {
    images: {
        name: "Images",
        description: "Can analyze and understand images.",
        Icon: (
            <Eye className="size-4.5 p-0.25 text-rose-900 bg-rose-200 rounded-xs"/>
        ),
    },
    pdfs: {
        name: "PDFs",
        description: "Can read and understand PDF documents.",
        Icon: (
            <FileIcon className="size-4.5 p-0.25 text-blue-900 bg-blue-200 rounded-xs"/>
        ),
    },
    reasoning: {
        name: "Reasoning",
        description: "Supports advanced reasoning capabilities.",
        Icon: (
            <Brain className="size-4.5 p-0.25 text-red-900 bg-red-300 rounded-xs"/>
        ),
    },
    reasoningEffort: {
        name: "Reasoning Effort",
        description: "Allows control over the depth of reasoning performed.",
        Icon: (
            <BrainCog className="size-4.5 p-0.25 text-yellow-900 bg-yellow-200 rounded-xs"/>
        ),
    },
    search: {
        name: "Search",
        description: "Can perform web searches to retrieve up-to-date information.",
        Icon: (
            <Globe className="size-4.5 p-0.25 text-green-900 bg-green-200 rounded-xs"/>
        ),
    },
};

function modelIsKnown(modelId: string): modelId is ModelId {
    return modelIds.includes(modelId as ModelId);
}

export function getModelDisplayNameById(id: string) {
    if (!modelIsKnown(id)) {
        return id;
    }
    return `${models[id].series} ${models[id].name}${models[id].variant ? ` (${models[id].variant})` : ""}`;
}

export function getModelByProviderId(providerId: string): Model | undefined {
    return Object.values(models).find((model) => model.providerId === providerId);
}

const modelIds = [
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3.7-sonnet",
    "anthropic/claude-sonnet-4",
    "openai/gpt-4o",
    "openai/gpt-o3-mini",
    "openai/gpt-o4-mini",
    "google/gemini-2.0-flash",
    "google/gemini-2.5-flash",
    "google/gemini-2.5-flash-preview",
    "google/gemini-2.0-flash-lite",
    "google/gemini-2.5-pro",
    "meta-llama/llama-4-scout",
    "meta-llama/llama-4-maverick",
    "openai/gpt-4.1",
    "openai/gpt-4.1-mini",
    "openai/gpt-4.1-nano",
    "deepseek/deepseek-r1-0528",
    "deepseek/deepseek-chat-v3-0324",
    "qwen/qwen3-32b",
] as const;

const ModelCreators = [
    "OpenAI",
    "Anthropic",
    "Google",
    "Meta",
    "DeepSeek",
    "Qwen",
] as const;

export type ModelId = (typeof modelIds)[number];
export type ModelCreator = (typeof ModelCreators)[number];

export const models: Record<ModelId, Model> = {
    "openai/gpt-4o-mini": {
        id: "openai/gpt-4o-mini",
        providerId: "openai/gpt-4o-mini",
        series: "GPT",
        name: "4o-mini",
        creator: "OpenAI",
        shortDescription: "Faster, less precise GPT-4o",
        fullDescription:
            "Like gpt-4o, but faster. This model sacrifices some of the original GPT-4o's precision for significantly reduced latency. It accepts both text and image inputs.",
        defaultFavorite: true,
        features: ["images"],
    },
    "anthropic/claude-3.5-sonnet": {
        id: "anthropic/claude-3.5-sonnet",
        providerId: "anthropic/claude-3.5-sonnet",
        series: "Claude",
        name: "3.5 Sonnet",
        creator: "Anthropic",
        shortDescription: "Anthropic's flagship model",
        fullDescription:
            "Smart model for complex problems. Known for being good at code and math. Also kind of slow and expensive.",
        features: ["images", "pdfs"],
    },
    "anthropic/claude-3.7-sonnet": {
        id: "anthropic/claude-3.7-sonnet",
        providerId: "anthropic/claude-3.7-sonnet",
        series: "Claude",
        name: "3.7 Sonnet",
        creator: "Anthropic",
        shortDescription: "Anthropic's flagship model",
        fullDescription:
            "The last gen model from Anthropic (but you can make it think). Better at code, math, and more. Also kind of slow and expensive.",
        features: ["images", "pdfs", "reasoning", "reasoningEffort"],
    },
    "anthropic/claude-sonnet-4": {
        id: "anthropic/claude-sonnet-4",
        providerId: "anthropic/claude-sonnet-4",
        series: "Claude",
        name: "4 Sonnet",
        creator: "Anthropic",
        shortDescription: "Anthropic's flagship model",
        defaultFavorite: true,
        fullDescription:
            "The latest model from Anthropic (but you can make it think). Claude Sonnet 4 is a significant upgrade to Claude Sonnet 3.7, delivering superior coding and reasoning while responding more precisely to your instructions.",
        features: ["images", "pdfs", "reasoning", "reasoningEffort", "search"],
    },
    "openai/gpt-4o": {
        id: "openai/gpt-4o",
        providerId: "openai/gpt-4o",
        series: "GPT",
        name: "4o",
        creator: "OpenAI",
        shortDescription: "OpenAI's flagship; versatile and intelligent",
        fullDescription:
            "OpenAI's flagship non-reasoning model. Works with text and images. Relatively smart. Good at most things.",
        features: ["images", "search"],
    },

    "openai/gpt-o3-mini": {
        id: "openai/gpt-o3-mini",
        providerId: "openai/gpt-o3-mini",
        series: "o3",
        name: "mini",
        creator: "OpenAI",
        shortDescription: "OpenAI's previous small reasoning model",
        fullDescription:
            "A small, fast, super smart reasoning model. OpenAI clearly didn't want DeepSeek to be getting all the attention. Good at science, math, and coding, even if it's not as good at CSS.",
        features: ["reasoning", "reasoningEffort"],
    },
    "openai/gpt-o4-mini": {
        id: "openai/gpt-o4-mini",
        providerId: "openai/gpt-o4-mini",
        series: "o4",
        name: "mini",
        creator: "OpenAI",
        shortDescription: "OpenAI's latest small reasoning model",
        fullDescription:
            "A small, fast, even smarter reasoning model. o3-mini was great, this is even better. Good at science, math, and coding, even if it's not as good at CSS.",
        features: ["images", "reasoning", "reasoningEffort"],
    },

    "google/gemini-2.0-flash": {
        id: "google/gemini-2.0-flash",
        providerId: "google/gemini-2.0-flash-001",
        series: "Gemini",
        name: "2.0 Flash",
        creator: "Google",
        shortDescription: "Google's latest stable model",
        fullDescription:
            "Google's flagship model, known for speed and accuracy (and also web search!). Not quite as smart as Claude 3.5 Sonnet, but WAY faster and cheaper. Also has an insanely large context window (it can handle a lot of data).",
        features: ["images", "pdfs", "search"],
    },
    "google/gemini-2.5-flash": {
        id: "google/gemini-2.5-flash",
        providerId: "google/gemini-2.5-flash",
        series: "Gemini",
        name: "2.5 Flash",
        creator: "Google",
        shortDescription: "Google's latest fast model",
        fullDescription:
            "Google's latest fast model, known for speed and accuracy (and also web search!). Not quite as smart as Claude 3.5 Sonnet, but WAY faster and cheaper. Also has an insanely large context window (it can handle a lot of data).",
        features: ["images", "pdfs", "search", "reasoning", "reasoningEffort"],
    },
    "google/gemini-2.5-flash-preview": {
        id: "google/gemini-2.5-flash-preview",
        providerId: "google/gemini-2.5-flash-preview-05-20",
        series: "Gemini",
        name: "2.5 Flash",
        variant: "Preview",
        creator: "Google",
        defaultFavorite: true,
        shortDescription: "Google's latest fast model",
        fullDescription: "Google's latest fast model",
        features: ["images", "pdfs", "search"],
    },
    "google/gemini-2.0-flash-lite": {
        id: "google/gemini-2.0-flash-lite",
        providerId: "google/gemini-2.0-flash-lite-001",
        series: "Gemini",
        name: "2.0 Flash Lite",
        creator: "Google",
        shortDescription: "Faster, less precise Gemini model",
        fullDescription:
            "Similar to 2.0 Flash, but even faster. Not as smart, but still good at most things.",
        features: ["images", "pdfs"],
    },
    "google/gemini-2.5-pro": {
        id: "google/gemini-2.5-pro",
        providerId: "google/gemini-2.5-pro",
        series: "Gemini",
        name: "2.5 Pro",
        creator: "Google",
        shortDescription: "Google's newest experimental model",
        fullDescription:
            "Google's most advanced model, excelling at complex reasoning and problem-solving. Particularly strong at tackling difficult code challenges, mathematical proofs, and STEM problems. With its massive context window, it can deeply analyze large codebases, datasets and technical documents to provide comprehensive solutions.",
        features: ["images", "pdfs", "search", "reasoning", "reasoningEffort"],
    },

    "meta-llama/llama-4-scout": {
        id: "meta-llama/llama-4-scout",
        providerId: "meta-llama/llama-4-scout",
        series: "Llama",
        name: "4 Scout",
        creator: "Meta",
        shortDescription: "Latest OSS model from Meta",
        fullDescription:
            "Llama 4 Scout 17B Instruct (16E) is a mixture-of-experts (MoE) language model developed by Meta, activating 17 billion parameters out of a total of 109B. It supports native multimodal input (text and image) and multilingual output (text and code) across 12 supported languages. Designed for assistant-style interaction and visual reasoning, Scout uses 16 experts per forward pass and features a context length of up to 10 million tokens, with a training corpus of ~40 trillion tokens. Built for high efficiency and local or commercial deployment, Llama 4 Scout incorporates early fusion for seamless modality integration. It is instruction-tuned for use in multilingual chat, captioning, and image understanding tasks. Released under the Llama 4 Community License, it was last trained on data up to August 2024 and launched publicly on April 5, 2025.",
        features: ["images"],
    },
    "meta-llama/llama-4-maverick": {
        id: "meta-llama/llama-4-maverick",
        providerId: "meta-llama/llama-4-maverick",
        series: "Llama",
        name: "4 Maverick",
        creator: "Meta",
        shortDescription: "Latest OSS model from Meta",
        fullDescription:
            "Llama 4 Maverick 17B Instruct (128E) is a high-capacity multimodal language model from Meta, built on a mixture-of-experts (MoE) architecture with 128 experts and 17 billion active parameters per forward pass (400B total). It supports multilingual text and image input, and produces multilingual text and code output across 12 supported languages. Optimized for vision-language tasks, Maverick is instruction-tuned for assistant-like behavior, image reasoning, and general-purpose multimodal interaction. Maverick features early fusion for native multimodality and a 1 million token context window. It was trained on a curated mixture of public, licensed, and Meta-platform data, covering ~22 trillion tokens, with a knowledge cutoff in August 2024. Released on April 5, 2025 under the Llama 4 Community License, Maverick is suited for research and commercial applications requiring advanced multimodal understanding and high model throughput.",
        features: ["images"],
    },

    "openai/gpt-4.1": {
        id: "openai/gpt-4.1",
        providerId: "openai/gpt-4.1",
        series: "GPT",
        name: "4.1",
        creator: "OpenAI",
        shortDescription: "OpenAI's Flagship Model",
        fullDescription:
            "GPT-4.1 is a flagship large language model optimized for advanced instruction following, real-world software engineering, and long-context reasoning. It outperforms GPT-4o and GPT-4.5 across coding (54.6% SWE-bench Verified), instruction compliance (87.4% IFEval), and multimodal understanding benchmarks.",
        features: ["images", "search"],
    },
    "openai/gpt-4.1-mini": {
        id: "openai/gpt-4.1-mini",
        providerId: "openai/gpt-4.1-mini",
        series: "GPT",
        name: "4.1 Mini",
        creator: "OpenAI",
        shortDescription: "Fast and accurate mid-sized model",
        defaultFavorite: true,
        fullDescription:
            "GPT-4.1 Mini is a mid-sized model delivering performance competitive with GPT-4o at substantially lower latency. It has a very large context window and scores 45.1% on hard instruction evals, 35.8% on MultiChallenge, and 84.1% on IFEval. Mini also shows strong coding ability (e.g., 31.6% on Aider's polyglot diff benchmark) and vision understanding.",
        features: ["images", "search"],
    },
    "openai/gpt-4.1-nano": {
        id: "openai/gpt-4.1-nano",
        providerId: "openai/gpt-4.1-nano",
        series: "GPT",
        name: "4.1 Nano",
        creator: "OpenAI",
        shortDescription: "Fastest model in the GPT-4.1 series",
        fullDescription:
            "For tasks that demand low latency, GPT‑4.1 nano is the fastest model in the GPT-4.1 series. It delivers exceptional performance at a small size with its 1 million token context window, and scores 80.1% on MMLU, 50.3% on GPQA, and 9.8% on Aider polyglot coding – even higher than GPT‑4o mini. It's ideal for tasks like classification or autocompletion.",
        features: ["images"],
    },
    "deepseek/deepseek-r1-0528": {
        id: "deepseek/deepseek-r1-0528",
        providerId: "deepseek/deepseek-r1-0528",
        series: "DeepSeek",
        name: "R1 0528",
        creator: "DeepSeek",
        shortDescription: "DeepSeek's flagship reasoning model",
        defaultFavorite: true,
        fullDescription:
            "DeepSeek R1 0528 is a large language model designed for advanced reasoning cost effectively.",
        features: ["pdfs", "reasoning", "reasoningEffort"],
    },
    "deepseek/deepseek-chat-v3-0324": {
        id: "deepseek/deepseek-chat-v3-0324",
        providerId: "deepseek/deepseek-chat-v3-0324",
        series: "DeepSeek",
        name: "Chat V3 0324",
        creator: "DeepSeek",
        shortDescription: "DeepSeek's flagship chat model",
        fullDescription: "DeepSeek's flagship chat model",
        features: ["pdfs", "reasoning", "reasoningEffort"],
    },
    "qwen/qwen3-32b": {
        id: "qwen/qwen3-32b",
        providerId: "qwen/qwen3-32b",
        series: "Qwen",
        name: "3 32B",
        creator: "Qwen",
        shortDescription: "Qwen's flagship model",
        fullDescription:
            "Qwen 3.5 32B is a large language model designed for advanced reasoning and multimodal tasks. It features a 1 million token context window, supports image input, and excels in complex reasoning benchmarks. With its high parameter count and extensive training data, Qwen 3.5 32B is optimized for both speed and accuracy in real-world applications.",
        features: ["images", "pdfs", "reasoning", "reasoningEffort"],
    },
} as const;

const favouriteModels = Object.entries(models).reduce(
    (acc, [key, model]) => {
        if (model.defaultFavorite) {
            acc[key as ModelId] = model;
        }
        return acc;
    },
    {} as Record<ModelId, Model>,
);

const otherModels = Object.entries(models).reduce(
    (acc, [key, model]) => {
        if (!model.defaultFavorite) {
            acc[key as ModelId] = model;
        }
        return acc;
    },
    {} as Record<ModelId, Model>,
);

// models by creator
const modelsByCreator = Object.entries(models).reduce(
    (acc, [_, model]) => {
        const creator = model.creator as ModelCreator;
        if (!acc[creator]) {
            acc[creator] = [];
        }
        acc[creator].push(model);
        return acc;
    },
    {} as Record<ModelCreator, Model[]>,
);

type ModelSelectorProps = {
    value: ResponseModel;
    setValue: Dispatch<SetStateAction<ResponseModel>>;
    attachments: File[];
    setAttachments: Dispatch<SetStateAction<File[]>>;
};

export function ModelSelector({
                                  value,
                                  setValue,
                                  attachments,
                                  setAttachments,
                              }: ModelSelectorProps) {
    const [open, setOpen] = useState(false);
    const [expandedViewOpen, setExpandedViewOpen] = useState(false);
    const selectedModel =
        getModelByProviderId(value.providerId) ?? models["openai/gpt-4.1-nano"];

    const handleModelChange = (modelId: ModelId) => {
        // Only keep the selected options that the new model supports
        setValue((prevModel) => {
            const newModel = models[modelId];
            // If new model does not support images, clear attachments
            if (!newModel.features?.includes("images")) {
                setAttachments([]);
            }
            return {
                providerId: newModel.providerId,
                options: {
                    webSearch: newModel.features?.includes("search")
                        ? prevModel.options.webSearch
                        : undefined,
                    reasoningEffort: newModel.features?.includes("reasoningEffort")
                        ? prevModel.options.reasoningEffort
                        : undefined,
                },
            };
        });
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const files = Array.from(e.target.files);
        setAttachments(files);
    };

    return (
        <div className="flex items-center gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="accent"
                        // biome-ignore lint/a11y/useSemanticElements: Custom
                        role="combobox"
                        aria-expanded={open}
                        className="w-fit justify-between"
                        size="sm"
                    >
                        <ModelCreatorLogo creator={selectedModel.creator}/>
                        {value
                            ? `${selectedModel.series} ${selectedModel.name} ${selectedModel.variant ? `(${selectedModel.variant})` : ""}`
                            : "Select model..."}
                        <ChevronsUpDown className="opacity-50"/>
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    className="w-fit max-w-[90vw] h-fit max-h-[90vh] p-0 border border-accent/20"
                    style={
                        {
                            "--thumb-width": "105px",
                            "--thumb-height": "150px",
                        } as CSSProperties
                    }
                >
                    <Command
                        className="bg-radial-[at_100%_0%] from-accent-foreground/30 via-60% via-popover to-popover">
                        <CommandInput placeholder="Search models..."/>
                        {/* Items list */}

                        {expandedViewOpen ? (
                            <CommandList className="h-fit max-h-[70vh] overflow-y-auto overflow-x-hidden !max-w-full">
                                <CommandEmpty>No model found.</CommandEmpty>
                                <CommandGroup className="w-fit">
                                    <h3 className="px-3 text-lg text-accent-foreground font-bold">
                                        Favourites
                                    </h3>
                                    <div
                                        className="flex flex-wrap w-[min(calc(var(--thumb-width)_*_5_+_4_*_var(--spacing)_*_4),80vw)] gap-3 p-2">
                                        {Object.entries(favouriteModels).map(([key, model]) => (
                                            <CommandItem
                                                key={key}
                                                value={key}
                                                onSelect={(currentValue) => {
                                                    handleModelChange(currentValue as ModelId);
                                                    setOpen(false);
                                                }}
                                                className="p-0 w-[var(--thumb-width)] h-[var(--thumb-height)]"
                                            >
                                                <ModelSelectItemThumb model={model}/>
                                            </CommandItem>
                                        ))}
                                    </div>
                                </CommandGroup>
                                <CommandGroup className="w-fit">
                                    <h3 className="px-3 text-lg text-accent-foreground font-bold">
                                        Others
                                    </h3>
                                    <div
                                        className="flex flex-wrap w-[min(calc(var(--thumb-width)_*_5_+_4_*_var(--spacing)_*_4),80vw)] gap-3 p-2">
                                        {Object.entries(otherModels).map(([key, model]) => (
                                            <CommandItem
                                                key={key}
                                                value={key}
                                                onSelect={(currentValue) => {
                                                    handleModelChange(currentValue as ModelId);
                                                    setOpen(false);
                                                }}
                                                className="p-0 w-[var(--thumb-width)] h-[var(--thumb-height)]"
                                            >
                                                <ModelSelectItemThumb model={model}/>
                                            </CommandItem>
                                        ))}
                                    </div>
                                </CommandGroup>
                            </CommandList>
                        ) : (
                            <CommandList>
                                <CommandEmpty>No model found.</CommandEmpty>
                                <CommandGroup className="space-y-6">
                                    {Object.entries(favouriteModels).map(([key, model]) => (
                                        <CommandItem
                                            key={key}
                                            value={key}
                                            onSelect={(currentValue) => {
                                                handleModelChange(currentValue as ModelId);
                                                setOpen(false);
                                            }}
                                        >
                                            <ModelSelectListItem model={model}/>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        )}

                        <CommandSeparator/>
                        {/*	Show all */}
                        <CommandGroup className="flex items-center justify-between p-2">
                            <Button
                                variant="ghost"
                                onClick={() => setExpandedViewOpen((prev) => !prev)}
                            >
                                {expandedViewOpen ? (
                                    <>
                                        <ArrowLeft/> Favourites
                                    </>
                                ) : (
                                    <>
                                        <Expand/> View All
                                    </>
                                )}
                            </Button>
                        </CommandGroup>
                    </Command>
                </PopoverContent>
            </Popover>
            {selectedModel.features?.includes("search") ? (
                <Button
                    variant="accent"
                    type="button"
                    className={value.options.webSearch ? "" : "bg-muted-foreground"}
                    onClick={(e) => {
                        e.preventDefault();
                        setValue((prevModel) => ({
                            providerId: prevModel.providerId,
                            options: {
                                ...prevModel.options,
                                webSearch: !prevModel.options.webSearch,
                            },
                        }));
                    }}
                    size="sm"
                >
                    <Globe className="size-6 p-0.5"/> Search
                </Button>
            ) : null}
            {selectedModel.features?.includes("reasoningEffort") ? (
                <Select
                    value={value.options.reasoningEffort}
                    onValueChange={(value) => {
                        setValue((prevModel) => ({
                            providerId: prevModel.providerId,
                            options: {
                                ...prevModel.options,
                                reasoningEffort: value as ModelReasoningEffort,
                            },
                        }));
                    }}
                >
                    <SelectPrimitive.Trigger data-slot="select-trigger" asChild>
                        <Button
                            variant="accent"
                            className={
                                value.options.reasoningEffort
                                    ? value.options.reasoningEffort === "off"
                                        ? "bg-amber-500"
                                        : ""
                                    : "bg-muted-foreground"
                            }
                            size="sm"
                        >
                            <BrainCog className="size-6 p-0.5"/>{" "}
                            {value.options.reasoningEffort ? <SelectValue/> : "Level"}
                        </Button>
                    </SelectPrimitive.Trigger>
                    <SelectContent>
                        {(["off", "low", "medium", "high"] as ModelReasoningEffort[]).map(
                            (level) => (
                                <SelectItem key={level} value={level}>
                                    {level.charAt(0).toUpperCase() + level.slice(1)}
                                </SelectItem>
                            ),
                        )}
                    </SelectContent>
                </Select>
            ) : null}

            {selectedModel.features?.includes("images") ? (
                <label htmlFor="attachments">
                    <input
                        name="attachments"
                        id="chat-input-attachments"
                        type="file"
                        accept={
                            selectedModel.features?.includes("pdfs")
                                ? "image/png,image/jpeg,application/pdf"
                                : "image/png,image/jpeg"
                        }
                        className="hidden"
                        onChange={handleFileChange}
                        max={4}
                        multiple
                    />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="accent"
                                className={`p-0 relative ${!attachments.length ? "bg-muted-foreground" : ""}`}
                                size="sm"
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    const fileInput = document.getElementById(
                                        "chat-input-attachments",
                                    ) as HTMLInputElement;
                                    if (fileInput) {
                                        fileInput.click();
                                    }
                                }}
                            >
                                <Paperclip className="size-6 p-0.5"/>
                                {attachments.length ? (
                                    <Badge className="absolute size-4 -top-2 -right-2">
                                        {attachments.length}
                                    </Badge>
                                ) : null}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {attachments.length
                                ? `Attached ${attachments.length} file${attachments.length > 1 ? "s" : ""}, ${attachments.map((a) => a.name).join(", ")}`
                                : "Attach files (images or PDFs)"}
                        </TooltipContent>
                    </Tooltip>
                    {attachments.length ? (
                        <Button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                const inp = document.getElementById(
                                    "chat-input-attachments",
                                ) as HTMLInputElement;
                                if (inp) {
                                    inp.value = "";
                                }
                                setAttachments([]);
                            }}
                            size="sm"
                            variant="accent"
                            className="bg-destructive text-destructive-foreground p-0 ml-2"
                        >
                            <LucideX className="size-6 p-0.5"/>
                        </Button>
                    ) : null}
                </label>
            ) : null}
        </div>
    );
}

type Model = {
    id: ModelId;
    providerId: string;
    series: string;
    name: string;
    variant?: string;
    creator: ModelCreator;
    shortDescription: string;
    fullDescription: string;
    defaultFavorite?: boolean;
    features?: readonly (keyof typeof modelFeatures)[];
};

type ModelSelectItemProps = {
    model: Model;
    // onSelect?: (modelId: string) => void;
};

function ModelSelectItemThumb({model}: ModelSelectItemProps) {
    return (
        <div
            className="border border-accent-foreground/20 flex flex-col text-sm items-center justify-between p-2 w-[var(--thumb-width)] h-[var(--thumb-height)] bg-background/90 rounded-lg cursor-pointer hover:bg-background/70">
            {/* Provider log placeholder	*/}

            <div className="text-muted-foreground text-center">
                <ModelCreatorLogo
                    creator={model.creator}
                    className="text-foreground size-8 mx-auto mb-1"
                />
                <span className="font-bold text-foreground text-base">
					{model.series}
				</span>
                <br/>
                <span className="font-semibold text-foreground text-sm">
					{model.name}
				</span>
                <br/>
                {model.variant && (
                    <span className="text-xs font-semibold text-accent-foreground">
						({model.variant})
					</span>
                )}
            </div>
            {/* Feature icons	*/}
            <div className="w-fit flex items-center flex-wrap justify-center gap-1">
                {model.features?.map((feature) => {
                    const {Icon} = modelFeatures[feature];
                    return (
                        <Tooltip key={feature}>
                            <TooltipTrigger>{Icon}</TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs">
                                    {modelFeatures[feature].name} -{" "}
                                    {modelFeatures[feature].description}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>
        </div>
    );
}

type ModelSelectListItemProps = {
    model: Model;
};

function ModelSelectListItem({model}: ModelSelectListItemProps) {
    return (
        <div className="flex items-center justify-between w-full p-2 min-w-xs">
            {/* Provider logo placeholder */}

            <div className="flex items-center gap-4">
                <ModelCreatorLogo
                    creator={model.creator}
                    className="text-accent-foreground size-6"
                />
                <span className="text-sm font-medium">
					{model.series} {model.name}
				</span>
                {model.variant && (
                    <span className="text-xs text-muted-foreground">
						({model.variant})
					</span>
                )}
            </div>
            {/* Feature icons */}
            <div className="w-fit flex items-center justify-end gap-1">
                {model.features?.map((feature) => {
                    const {Icon} = modelFeatures[feature];
                    return (
                        <Tooltip key={feature}>
                            <TooltipTrigger>{Icon}</TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs">
                                    {modelFeatures[feature].name} -{" "}
                                    {modelFeatures[feature].description}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>
        </div>
    );
}

type InPlaceModelSelectorProps = {
    Trigger: ReactNode;
    onChange: (modelProviderId: string) => void;
    defaultModelProviderId: string;
};

export function InPlaceModelSelector({
                                         onChange,
                                         Trigger,
                                         defaultModelProviderId,
                                     }: InPlaceModelSelectorProps) {
    const defaultModel = getModelByProviderId(defaultModelProviderId);

    return (
        <Menubar className="bg-transparent flex h-fit items-center gap-1 rounded-md border-none p-0 shadow-none">
            <MenubarMenu>
                <MenubarTrigger asChild>{Trigger}</MenubarTrigger>
                <MenubarContent className="flex flex-col gap-2 p-1 w-fit min-w-48">
                    <MenubarItem
                        className="flex-col items-start gap-1"
                        onSelect={() => {
                            onChange(defaultModelProviderId);
                        }}
                    >
						<span className="flex items-center h-6 w-fit">
							<RefreshCcw className="size-5 mr-3"/>
							Retry with same
						</span>
                        <br/>
                        <span className="text-xs ml-8 text-accent-foreground">
							{defaultModel
                                ? getModelDisplayNameById(defaultModel.id)
                                : defaultModelProviderId}
						</span>
                    </MenubarItem>
                    <div className="text-xs text-secondary-foreground flex items-center justify-between w-full px-2">
                        <div className="h-0.5 w-8 bg-secondary"/>
                        or try another
                        <div className="h-0.5 w-8 bg-secondary"/>
                    </div>
                    {Object.entries(modelsByCreator).map(([creator, models]) => (
                        <MenubarSub key={creator}>
                            <MenubarSubTrigger>
								<span className="flex items-center w-fit">
									<ModelCreatorLogo
                                        creator={creator as ModelCreator}
                                        className="text-accent-foreground size-5 mr-2"
                                    />
                                    {creator}
								</span>
                            </MenubarSubTrigger>
                            <MenubarSubContent>
                                {models.map((model: Model) => (
                                    <MenubarItem
                                        key={model.providerId}
                                        onSelect={() => onChange(model.providerId)}
                                    >
                                        <ModelSelectListItem model={model}/>
                                    </MenubarItem>
                                ))}
                            </MenubarSubContent>
                        </MenubarSub>
                    ))}
                </MenubarContent>
            </MenubarMenu>
        </Menubar>
    );
}

type CreatorLogoProps = {
    className?: string;
};

type ModelCreatorLogoProps = CreatorLogoProps & {
    creator: ModelCreator;
};

export function ModelCreatorLogo({
                                     className,
                                     creator,
                                 }: ModelCreatorLogoProps) {
    switch (creator) {
        case "OpenAI":
            return <OpenAILogo className={className}/>;
        case "Anthropic":
            return <AnthropicLogo className={className}/>;
        case "Google":
            return <GeminiLogo className={className}/>;
        case "Meta":
            return <MetaLogo className={className}/>;
        case "DeepSeek":
            return <DeepSeekLogo className={className}/>;
        case "Qwen":
            return <QwenLogo className={className}/>;
    }
}

export function AnthropicLogo({className}: CreatorLogoProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            fillRule="evenodd"
            style={{flex: "none", lineHeight: "1"}}
            viewBox="0 0 24 24"
            className={className}
        >
            <title>Anthropic Logo</title>
            <path
                d="M13.827 3.52h3.603L24 20h-3.603zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z"/>
        </svg>
    );
}

export function OpenAILogo({className}: CreatorLogoProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            fillRule="evenodd"
            style={{flex: "none", lineHeight: "1"}}
            viewBox="0 0 24 24"
            className={className}
        >
            <title>OpenAI Logo</title>
            <path
                d="M21.55 10.004a5.42 5.42 0 0 0-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.6 5.6 0 0 0 10.831 1C8.39.995 6.224 2.546 5.473 4.838A5.55 5.55 0 0 0 1.76 7.496a5.49 5.49 0 0 0 .691 6.5 5.42 5.42 0 0 0 .477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.59 5.59 0 0 0 13.168 23c2.443.006 4.61-1.546 5.361-3.84a5.55 5.55 0 0 0 3.715-2.66 5.49 5.49 0 0 0-.693-6.497zm-8.381 11.558a4.2 4.2 0 0 1-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 0 0 .364-.623v-6.176l1.877 1.069q.03.017.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123M4.192 17.78a4.06 4.06 0 0 1-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.07.07 0 0 1-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 0 1 5.198 6.41l-.002.151v5.06a.71.71 0 0 0 .364.624l5.42 3.087-1.876 1.07a.07.07 0 0 1-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54-5.42-3.088L14.896 7.6a.07.07 0 0 1 .063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.16 4.16 0 0 1-2.174 1.807V12.38a.71.71 0 0 0-.363-.623zm1.867-2.773-.132-.078-4.44-2.53a.73.73 0 0 0-.729 0l-5.42 3.088V7.325a.07.07 0 0 1 .027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757zm-11.741 3.81-1.877-1.068a.07.07 0 0 1-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 0 0-.365.623zv.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375z"/>
        </svg>
    );
}

export function GeminiLogo({className}: CreatorLogoProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            fillRule="evenodd"
            style={{flex: "none", lineHeight: "1"}}
            viewBox="0 0 24 24"
            className={className}
        >
            <title>Gemini Logo</title>
            <path
                d="M12 24A14.3 14.3 0 0 0 0 12 14.3 14.3 0 0 0 12 0a14.305 14.305 0 0 0 12 12 14.305 14.305 0 0 0-12 12"/>
        </svg>
    );
}

export function MetaLogo({className}: CreatorLogoProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            fillRule="evenodd"
            style={{flex: "none", lineHeight: "1"}}
            viewBox="0 0 24 24"
            className={className}
        >
            <title>Meta Logo</title>
            <path
                d="M6.897 4c1.915 0 3.516.932 5.43 3.376l.282-.373q.285-.37.58-.71l.313-.35C14.588 4.788 15.792 4 17.225 4c1.273 0 2.469.557 3.491 1.516l.218.213c1.73 1.765 2.917 4.71 3.053 8.026l.011.392.002.25c0 1.501-.28 2.759-.818 3.7l-.14.23-.108.153a3.6 3.6 0 0 1-1.086 1.009l-.265.142-.087.04a4 4 0 0 1-.302.118 4.1 4.1 0 0 1-1.33.208c-.524 0-.996-.067-1.438-.215-.614-.204-1.163-.56-1.726-1.116l-.227-.235c-.753-.812-1.534-1.976-2.493-3.586l-1.43-2.41-.544-.895-1.766 3.13-.343.592C7.597 19.156 6.227 20 4.356 20c-1.21 0-2.205-.42-2.936-1.182l-.168-.184c-.484-.573-.837-1.311-1.043-2.189l-.067-.32a9 9 0 0 1-.136-1.288L0 14.468q.003-1.119.174-2.23l.1-.573c.298-1.53.828-2.958 1.536-4.157l.209-.34c1.177-1.83 2.789-3.053 4.615-3.16zm-.033 2.615-.201.01c-.83.083-1.606.673-2.252 1.577l-.138.199-.01.018c-.67 1.017-1.185 2.378-1.456 3.845l-.004.022a12.6 12.6 0 0 0-.207 2.254l.002.188q.006.27.04.54l.043.291c.092.503.257.908.486 1.208l.117.137c.303.323.698.492 1.17.492 1.1 0 1.796-.676 3.696-3.641l2.175-3.4.454-.701-.139-.198C9.11 7.3 8.084 6.616 6.864 6.616zm10.196-.552-.176.007c-.635.048-1.223.359-1.82.933l-.196.198c-.439.462-.887 1.064-1.367 1.807l.266.398q.269.411.55.858l.293.475 1.396 2.335.695 1.114c.583.926 1.03 1.6 1.408 2.082l.213.262c.282.326.529.54.777.673l.102.05c.227.1.457.138.718.138q.265.002.518-.073c.338-.104.61-.32.813-.637l.095-.163.077-.162c.194-.459.29-1.06.29-1.785l-.006-.449c-.08-2.871-.938-5.372-2.2-6.798l-.176-.189c-.67-.683-1.444-1.074-2.27-1.074"/>
        </svg>
    );
}

export function DeepSeekLogo({className}: CreatorLogoProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            fillRule="evenodd"
            style={{flex: "none", lineHeight: "1"}}
            viewBox="0 0 24 24"
            className={className}
        >
            <title>DeepSeek Logo</title>
            <path
                d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.5 5.5 0 0 1-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11 11 0 0 0-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428s-1.67.295-2.687.684a3 3 0 0 1-.465.137 9.6 9.6 0 0 0-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.2 4.2 0 0 0 1.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.7 4.7 0 0 1 1.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614m1-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .2.288.306.306 0 0 1-.31.307.303.303 0 0 1-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.552-.758a1.7 1.7 0 0 1 .016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.56.56 0 0 1-.254-.078.253.253 0 0 1-.114-.358c.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452"/>
        </svg>
    );
}

export function QwenLogo({className}: CreatorLogoProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            fillRule="evenodd"
            style={{flex: "none", lineHeight: "1"}}
            viewBox="0 0 24 24"
            className={className}
        >
            <title>Qwen Logo</title>
            <path
                d="M12.604 1.34q.59 1.035 1.174 2.075a.18.18 0 0 0 .157.091h5.552q.26 0 .446.327l1.454 2.57c.19.337.24.478.024.837q-.39.646-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77q-.656 1.177-1.335 2.34c-.159.272-.352.375-.68.37a43 43 0 0 0-2.327.016.1.1 0 0 0-.081.05 575 575 0 0 1-2.705 4.74c-.169.293-.38.363-.725.364q-1.495.005-3.017.002a.54.54 0 0 1-.465-.271l-1.335-2.323a.09.09 0 0 0-.083-.049H4.982a1.8 1.8 0 0 1-.805-.092l-1.603-2.77a.54.54 0 0 1-.002-.54l1.207-2.12a.2.2 0 0 0 0-.197 551 551 0 0 1-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965q.697-1.22 1.387-2.436c.132-.234.304-.334.584-.335a338 338 0 0 1 2.589-.001.12.12 0 0 0 .107-.063l2.806-4.895a.49.49 0 0 1 .422-.246c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34m-3.432.403a.06.06 0 0 0-.052.03L6.254 6.788a.16.16 0 0 1-.135.078H3.253q-.084 0-.041.074l5.81 10.156q.037.062-.034.063l-2.795.015a.22.22 0 0 0-.2.116l-1.32 2.31q-.066.117.068.118l5.716.008q.068 0 .104.061l1.403 2.454q.069.122.139 0l5.006-8.76.783-1.382a.055.055 0 0 1 .096 0l1.424 2.53a.12.12 0 0 0 .107.062l2.763-.02a.04.04 0 0 0 .035-.02.04.04 0 0 0 0-.04l-2.9-5.086a.11.11 0 0 1 0-.113l.293-.507 1.12-1.977q.036-.062-.035-.062H9.2q-.088 0-.043-.077l1.434-2.505a.11.11 0 0 0 0-.114L9.225 1.774a.06.06 0 0 0-.053-.031m6.29 8.02q.07 0 .034.06l-.832 1.465-2.613 4.585a.06.06 0 0 1-.05.029.06.06 0 0 1-.05-.029L8.498 9.841q-.03-.051.028-.054l.216-.012 6.722-.012z"/>
        </svg>
    );
}
