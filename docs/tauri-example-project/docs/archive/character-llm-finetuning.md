# Fine-Tuning LLMs on Character Dialogue

## The Concept

Your instinct about fine-tuning the LLM (not just TTS) on character dialogue is fascinating and could be a real differentiator. Here's why it matters and how it could work.

## What Fine-Tuning Would Achieve

### Beyond Just Voice - Getting the Mind

**Current approach (TTS only):**

- Character sounds like Scar
- But speaks with generic AI patterns
- Disconnect between voice and personality

**With LLM fine-tuning:**

- Character sounds AND thinks like Scar
- Uses their vocabulary, speech patterns, catchphrases
- Maintains their worldview and personality

### Examples of What Changes

**Generic Assistant:**
> "I'd be happy to help you with that request."

**Scar-tuned Assistant:**
> "Oh, how delightfully... tedious. But I suppose I could spare a moment for such matters."

**Generic on power:**
> "Power can be used for good or bad purposes."

**Scar on power:**
> "Power, my dear friend, is the only truth in this savage world. The rest is merely... sentiment."

## Technical Implementation

### Data Preparation

```python
# Extract character dialogue from transcripts
character_dataset = []

for scene in movie_transcript:
    if scene.speaker == "SCAR":
        character_dataset.append({
            "instruction": extract_context(scene),
            "input": previous_dialogue,
            "output": scene.dialogue
        })

# Add character description
system_prompt = """
You are Scar from The Lion King. You are intelligent, theatrical, 
sardonic, and speak with Shakespearean eloquence. You often use 
metaphors and have a dry, calculating wit. You see the world as a 
chess game where only the clever survive.
"""
```

### Fine-Tuning Strategy

Option 1: LoRA/QLoRA (Recommended)

- Preserves general knowledge
- Adds character "style layer"
- 10-100x smaller than full fine-tune
- Can swap characters easily

```python
# Pseudo-code for LoRA fine-tuning
model = load_base_model("llama-3.2-3b")
lora_config = LoRAConfig(
    r=16,  # rank
    target_modules=["q_proj", "v_proj"],
    task_type="CAUSAL_LM"
)

# Fine-tune on character dialogue
trainer = SFTTrainer(
    model=model,
    train_dataset=character_dataset,
    peft_config=lora_config,
    max_seq_length=512,
)
```

Option 2: Full Fine-Tuning

- More expensive computationally
- Risk of catastrophic forgetting
- Harder to maintain multiple characters

## Is There Enough Data?

### Typical Movie Dialogue Stats

- Average movie: ~7,500-9,000 words of dialogue
- Main character: ~15-25% of dialogue
- Scar specifically: ~1,500-2,000 words in Lion King

### Training Requirements

- Minimum useful: ~1,000 examples
- Ideal: 10,000+ examples
- Each word can be multiple training examples

### Data Augmentation Strategies

1. **Scene Context Expansion**

   ```text
   Input: "What do you want?"
   Output: "I want... what's mine. The throne. The kingdom. Everything the light touches."
   ```

2. **Paraphrasing**
   - Generate variations of existing dialogue
   - Maintain character voice

3. **Cross-Media Dataset**
   - Include dialogue from sequels, series, books
   - Fan-fiction that captures voice well (controversial)

4. **Synthetic Expansion**
   - Use base model to generate "in-character" responses
   - Human-curate the best ones

## Expected Results

### What Works Well

- ✅ Vocabulary and word choice
- ✅ Sentence structure patterns  
- ✅ Catchphrases and verbal tics
- ✅ General attitude/tone
- ✅ Topic preferences

### What's Challenging

- ❓ Deep reasoning in character
- ❓ Maintaining consistency over long conversations
- ❓ Balancing character vs helpful assistant
- ❓ Avoiding repetitive responses

## Implementation Phases

### Phase 1: Basic Personality (System Prompt Only)

```python
system_prompt = f"""
You are {character_name}. Key traits:
- Speaking style: {extracted_patterns}
- Common phrases: {catchphrases}
- Worldview: {character_philosophy}
Always maintain character while being helpful.
"""
```

### Phase 2: LoRA Fine-Tuning

- Train small adapter on dialogue
- Test on progressively larger models
- Compare against prompt-only approach

### Phase 3: Advanced Techniques

- Reinforcement learning from character feedback
- Multi-character conversation training
- Emotion-aware response generation

## Interesting Possibilities

### 1. **Character Evolution**

Train on dialogue from different movie periods:

- Young Scar (innocent)
- Plotting Scar (calculating)  
- King Scar (paranoid)

### 2. **Cross-Character Conversations**

Fine-tune multiple characters and have them interact:

- Scar debates with Mufasa
- Villain roundtable discussions

### 3. **Interactive Storytelling**

Character stays true to their arc:

- Responds based on "current" point in story
- References past events appropriately

## Challenges & Solutions

### Challenge 1: Limited Dialogue

**Solution:** Combine approaches:

- System prompt for personality
- LoRA for speech patterns
- TTS for voice

### Challenge 2: Balancing Character vs Utility

**Solution:** Dual-mode responses:

```python
if task_focused:
    # More direct, but in character voice
    "The recipe requires... *sigh* ...such pedestrian ingredients..."
else:
    # Full character mode
    "Cooking? How dreadfully domestic. In the Pride Lands..."
```

### Challenge 3: Preventing Harmful Content

**Solution:** Safety layers:

- Base model safety training remains
- Additional filters for character-specific issues
- Clear "this is fictional" disclaimers

## Quick Experiment to Test Value

Before committing to full implementation:

1. **Week 1 Test:**
   - Take 50 lines of character dialogue
   - Create 200 training examples
   - Fine-tune small model (Phi-3 or similar)
   - Compare to prompt-only approach

2. **Evaluation Metrics:**
   - Vocabulary overlap with original
   - Blind user preference test
   - Catchphrase usage frequency
   - Sentiment consistency

3. **Decision Point:**
   - If 2x better than prompting → implement
   - If marginal improvement → stick to prompts
   - If worse → investigate why

## Conclusion

Fine-tuning LLMs on character dialogue is a powerful differentiator that could elevate this from "voice changer" to "digital actor." While technically challenging, it's feasible with modern tools and could create genuinely magical experiences.

The key is starting simple (prompts), testing with small models (LoRA), and only scaling up if the results justify the complexity. Even partial success would create a more immersive experience than any current solution offers.
