<!-- markdownlint-disable -->

Fuck with me here. I'm thinking this idea, okay? I want to sound like people. I want to sound like different people. You know how there are those accent artists, those people—Eddie Murphy used to be one. There's Jay, Jay, some guy. There are a bunch of Black people that do it, and some white people that were able to do it as well.

What would it take to make something where you could... Oh man, there's three levels to this. There's three levels to this, okay? I don't want the code yet, but I just want to chop this up, get the idea, get the vibe out, and see what's possible.

What if, okay, let's say you bought a movie or you downloaded it, you have access to it from whatever. Theoretically, you get the transcript. You get the full, actual transcript. I see this—something like SimplyScripts.com—and it has the full thing. Let me just try to see if I can grab one, just for, you know, let me see. 

Okay. Like, is there a—first of all, is there a script API? Maybe we need to build that. 

1. We might need to... 

Okay, so I'm seeing this, and I want you to look at it. So go to this GitHub. There's an interesting thing where they basically have a movie script database. There's a thing on basically... what website is this? I don't even know what website this is. 

Oh, GitHub. Okay, and they're saying that there's a utility that lets you collect scripts from several sources and create a database of 2.5k scripts as TXT files with the metadata for the movies. I would probably prefer JSON files. 

It should probably come kind of like that. But well, you can see how they say it can be formatted. I'm like, maybe we don't even have an API. 

A Postgres database with these things. Just absolutely cut it off. Or even potentially, maybe we fill a vector database with this, and then it's even faster. But anyway, the idea would be to create a huge, infinite database of movie scripts. And, you know, so we have all of the stuff with those movie scripts. That would be the first level, so we can make an API with it.

In general, for the internet, maybe recreate this thing that I'm looking at, this GitHub project, and make a modern version. Is there any modern sources that we should look at or could look at? I don't know. Maybe you should check through those sources and just double-check what's still accurate, what's still not accurate, what's still good, and what's still not good. 

Are there any sources not on there that maybe should be on there, like Russian movie sources or something like that? Is there any Chinese movie sources, Indian movie sources, or anything like that that might have scripts we should look at? I know IMDb is God, so is there anything else?

So once you have the movies, one of the things that I was thinking was, like, if you downloaded that movie, and this is the interesting part, and I don't know, this is the interesting part because syncing it with the actual movie is interesting. The actual movie, like, you know, either legally or just whatever. You were able to download the movie, you have it, maybe you bought it, you know, whatever. You have it. That, you have the physical file. I would like a software or something where you could put this file in, and it would basically automatically segment out all of the parts for a specific character. So let's say James Earl Jones in Lion King or Scar from Lion King. I want all the things where Scar from Lion King is speaking or singing. I want all of it. So we have a script that would literally go through and be able to cut up the clip so that you would be able to. 

Yeah, so just literally, you would end up with an audio file—theoretically, a `.wav` or `.mp3`—where you have just that character. Then, on top of that, the next level would be to be able to clean that audio. There were a couple of different people that I was looking at to clean the audio, I think.

If 11 Labs has an endpoint exposed for isolating audio, or if PlayHT has an endpoint exposed for isolating audio or for cleaning up tracks, I would be interested. I think the 11 Labs one was the best, but if somebody else has that as well, that would be cool. Or if there's an open-source version that they're probably pulling from that's state of the art, then I'm fine with using that as well. That is kind of an AI thing though, so might need to look into that and research it further. 

I'm fine with 11 Labs if it's the state of the art, if it's the best. I know that Adobe has this. I know that transcript editing from subtitles or from the transcript has been a thing for a while. I'm sure that there's an open-source platform or something that has transcript editing.

Let me just double check this. Wait, what is this? Did I bring my headphones? I think I found a project with them. They're probably smaller ones. 

Yeah, there was this thing called Description. I'm looking at it, and it looks like it kind of does it—at least what it does is it allows you to... The second GitHub thing that I linked does let you kind of skip through the project. I don't think it lets you actually edit the thing. Oh, yeah, this thing lets you change the transcript, but one second, one second. 

Anyway, to finish the idea, I forgot what I was talking about, but basically, the idea was theoretically we pull a transcript of a movie or subtitles of a movie and somehow match it up with the actual movie. We might need to do some level of transcription with that. We'll probably use a Whisper library or something like that. Of course, we have lots of open-source Whisper stuff. I don't know what the best one is—I think it's probably WhisperX. As far as what's ready to go, I think it's probably WhisperX. That would be if we need some level of transcription, then we could probably pull that. From what I can see, we have DeepSpeed, or we could just directly use Whisper CPP. Let me double-check. It's a high-inference model for ASR as VAD. Oh, this is sick. What is this? It's a lightweight implementation, allows it. Oh, wow. Well, I mean, this has a huge number of people on it. I don't even know what this is. It's saying that theoretically, you can make your own offline voice assistant using Whisper CPP.  

Okay, so cool. And then they have, obviously, Whisper large v3. And I think, honestly, a lot of these applications offline are using the same thing. You know, Super Whisper, all these different guys—they're using all this. All these guys are using something like this.  

I don't know. So, I don't know if Whisper X, Whisper CPP, or Faster Whisper are relevant when it comes to this. It seems like Whisper CPP is obviously great, but I'm wondering if there's anything else I should be looking at other than that.  

Of course, we have Kaldi. Kaldi's, to my knowledge, like the OG—this is OG, you know. But basically, what the idea here is, is that, okay, you know, we take a transcript, we match it up to a video, maybe we just transcribe the video and use the transcript or the subtitles as a source of truth or something like that. Then, we just kind of correct things and align them. Ultimately, we align it and have the ultimate 100% correct thing. And then we have that. Of course, we have MFA. I mean, everybody knows about MFA, I'm pretty sure. Do they have GitHub? Yeah, the Montreal Forced Aligner, I mean. Yeah, I mean, MFA is obviously... PolyglotDB. So, like, theoretically, you know, if we have a source of truth, then theoretically we can grab MFA and connect it up, right? And then we have a bunch of the models on open source as well, in the GitHub, but we also have a list of them online as well.  

What is this Language Data Store? I don't know what this is for. Let me just double check. Large-scale speech corpora. Well, I guess maybe we need it, maybe we don't. I'm not going to include it. But if we need that, then obviously MFA has that. So, we connect that, and then honestly, so in the end, the whole idea is that we're able to take, again, and I'm including all this stuff because I'm like, I don't know. We need to drill, by the way, like, this is all in an attempt to drill down. I'm giving you all this stuff because I don't want to remake something that already exists.

Truly, you should go through every single one of these, every single one of these, and, like, okay, this is what this is, this is what this is, this is what this is. And then what I'm looking for is a final thing, where it's like, hey, this is going to be the thing that this is going to be the best thing that we can make. You know, this is going to be the best thing where basically I can import a movie. Based on the movie that I import, we pull a transcript from, you know, a transcript is found or pulled or matched with something from our database. So we're not APIing every time; we just do a cron job every time we need stuff, and we just have a big thing that we just have. Okay, I prefer that to anything offline. You know, pull a transcript, match it up, and handle all the languages that are relevant. It's like, hey, match it up, and then either transcribe the movie—probably, I guess we have to transcribe the movie to an extent.

Subtitles, the official subtitles. You know, if it has official subtitles, then even that's perfect. Maybe we don't even need to do a lot of this stuff. If it has official subtitles, you're good, right? You could probably just get in there and start cutting up whatever you need to do.

Do it, but cool. And then basically in the end, you say, you pick—just like there's an option—you just pick a character, or maybe even automatically it just goes through and you just put it in. Then, for every character in that movie, it processes it so that every single character with any screen time has their exact clips pulled. We wouldn't just pull the audio; we would pull the audio and video so that way when it comes to the actual editing, you're able to see the clip. You're able to extend the clip a little bit one way or a little bit the other way to include the full thing where it might be getting chopped, or they might be overtalked by somebody, or there might be music that's doing something. But you're able to kind of move things one way or the other based on the actual clip, and then ultimately the idea would be you're able to export.

You're able to get that actual audio and go get it cleaned or get it optimized, you know, isolated. So you want to isolate the audio and then ultimately do a clone of that audio. Yeah, ultimately do a clone of the audio. And that would be—we have, and I have a script for that as well.

So we have an Unsloth Orpheus 3B TTS where, yeah, Unsloth says that I'm pretty sure from their blog that's the one that they recommend. Fine-tune TTS for free, yeah. Also, they have fine-tuning notebooks for even Whisper, so if we needed it, they have it. I don't know what we would need that for, but by the way, if we need to or if that's an interest, we can fine-tune Whisper V-Large using the Unsloth tools. They're the gods of all this. 

And they do have, I will say, they actually have an Orpheus. You know, they have a couple of things that we might be interested in. They have an Orpheus 3B and an Orpheus, like, a pre-trained 3B, which I don't know what either of those two things mean. 4Bit, which, obviously, I think you'd be able to run that fine.

So pre-trained is obviously just the raw, and then the fine-tuned is fine-tuned. So they include that. So, you know, that's fun.

So again, yeah, offline, we could have a quick fine-tuning of the TTS, or we can use the Play HT endpoint and get a state-of-the-art thing. I'm open to either one. I'd probably have both options.

So then, yeah, the idea is to pull everything, and then you just have voices generated for every single character. You can prioritize a certain character if you want it first. You can choose to only have one character done, or you could choose to process the whole movie.

I'm not 100% sure about that, or, yeah, running, like, actually being able to use those voices is something else, but, yeah, I think whatever you have, you train the model, and then basically you can use the model that you trained. 

So now I don't know what that means exactly. So one of the things would be, okay, does that mean that, you know, for any given—this is another question—like, I guess for any, if I had, let's say just locally, if I was pre-training all these models, would it be creating a whole new model for that thing? Or would it just be, you know, like this one model just has like 100 voices or 500 voices? You know, how is that actually running or working? Or is it basically like you need space for every model that you fine-tune to a specific voice? It sounds like the last thing I said—like you need space for all the models that you fine-tune for a specific voice—but I'd be interested in the correct answer to that question. 

The ultimate thing would be that you could then connect it to an engine and run it against something—like an official API—and have a very smart character. That would be the end goal, where you would be able to actually have an agent that you could speak to at whatever level. 

And all the other stuff that you can use depends on the level of smart that you want. So, if you wanted it fully offline, then again, you could download a model and use that directly. And then, if you wanted to run it against something smart, you could do that too. That's like the full idea, where I would probably lean towards using onslaught models just because they have a lot of different features. You know, they have quantized 4-bit versions of everything. So theoretically, my understanding is just that, yeah, they have the 4-bit version so that can run on basically anything. base and then instruct for a bit and then there's goof so uh and then so I'll include that as well and you can tell me how if and yeah wait 

Okay, so that's the last thing. Just to connect all this stuff together: basically, what I'm looking for is to get a movie, get the voices of people from the movie, isolate the voice, be able to edit/clean it up, and then export that voice. It doesn't necessarily need exporting, but you should be able to take that voice, isolate or enhance the vocal using some API or local tool, and then train a TTS model on it using either a local model or a state-of-the-art model. You should then be able to directly use that model inside of an agent that you control. Whether that's setting the system prompt or doing all the normal configurations, you should have full control. And whatever else, set the system prompt and then pick the model—whether it's a local model or it's an API—and you're able to talk to it. Then, you can have all the other features you need. We didn't even talk about all this stuff. You know, then we have the others and I'll include these as well. But then you have the example agents that we were going over. You know, we have all these example things of where we can bring in memory. We can bring in a full product, so you're able to go through, find a movie, find a person that you like.

And then have a local running voice for that person. What I like about it as well is that the whole idea is not that you are using this in production—this is for local use. To me, legally, this is just local use. Obviously, if you want to actually do something else with it or use your fine-tuned model for whatever purpose, that's on you. If you want to use your fine-tuned model for evil or for whatever you want to use it for, that is no one's business but yours. 

Your own truly, you know, it's just—yeah, so I just thought it would be cool to actually put all this together. And there's so many examples of these assistants out in the wild. I think one of the best ones is Disler. You know, Disler has an always-on AI assistant. It's the biggest thing on his GitHub, and it's absolutely sick. 

Of course, there are so many examples of these types of things. I only just grabbed this one because it’s right there, but yeah.

I basically just want all this information. It would be cool if I was able to make an app that was able to do all these things. So what I'm looking for is, what I want is—sorry, I probably said it multiple times—but I want you to go through all of these assets that I gave you and come up with, hey, okay, this is what we're doing. Or this is, you know, this is what, okay, I went through this. You know, I don't know if you need to necessarily summarize or go through all this stuff at the end or some point. Maybe you can, it's like, hey, I went through this, this uses this, this, this, this is the best use of this. You know, and I really want you to go through the files. You know what I mean? I'm being lazy here, but I compiled this, I did a lot of work, and so you can do some work as well. 

You can even go outside of these and find some other stuff. I'm sure you know, you're like a better researcher, you know. It's interesting. But go through all of the stuff. This is what this is. This is the difference. It was the difference between those three Whisper things. Like WhisperX does this, it's this speed, it's this, and then they're using these files and these files and these files. WhisperCPP is actually this, and it does this, this, this, and it's super fast. It's probably the best thing that we want to use because it's local, but whatever, this, this, and this. 

Or it's like something else. Let's actually go to Unsloth and use one of their Whisper models because they have a 4-bit quantized version or something like that. That's probably the best. Or this, or, and then it goes down. 

Okay, TTS. Well, we have some TTS here. We have, you know, Unsloth, the Orpheus 3B TTS from these guys. It's one of the probably higher-rated ones, but we also have the other options. As far as open-source TTS, probably the most popular ones, you know, we have... I mean, like Gemma just released a new model that's optimized for local use or small use. And then, of course, we have Fish-Speech—those guys have been killing it for a while. We have F5 TTS, we have XTS V2, and of course, we have my homie. 

You know, I have this thing that I paid for. My guy, Advanced Transcription, has a few training scripts and things in his setup, but I think the Unsloth scripts are probably better. 

And I think probably, you know, the Mellow TTS and Style TTS—these are pretty old models. 

Has any voice cloning. And anyway, the 1 billion parameter model that they did release is ass, so it's kind of dumb and weird anyway. So yeah, Orpheus is state of the art as far as I know now, unless somebody else has created something. I'm just going to Google it real quick and see if anybody has seen Sesame Labs. Yeah, I mean, they released a 1B variant, and they said they released CSMs now natively in Hugging Face's Transformers. I don't know what that means. What does that mean? 

Okay, so I guess it looks like they did a lot more. It looks like they've actually been open source, and they've actually been doing some stuff, which looks nice. So maybe we could look at CSM again. 

You know, the conversational speech model from the homies—maybe we could look at their stuff again. It really looks like they've done a little bit, and we have some interesting stuff with a lot of confidence. Again, you know, I just—I haven't seen anything super interesting from them, but you know. 

You know, the homies from—who is our friend? Yeah, we have Unsworth as well, and they have the notebooks that they were talking about for CSM fine-tuning. So, you know, we have a lot of stuff—models and different things. 

What I'm looking for, yeah, it's like I want to see, like, you understand each of the things that I gave you. We kind of categorize all the different sections, because I'm giving you a lot of shit here. It's like categorizing all the things, and then, okay, because we have probably, you know, we have the beginning where it's like, okay, just setting up things, just background stuff, movie transcripts, um, you know, library of sources of truth. Is that even something that we need? You know, I would—I'm leaning towards yes because I feel like I would be interested in it. It would be interesting if we had, yeah, it's like, I don't think all of the movies that I download have transcripts already in them. Some of them do, a lot of them don't. You know, have that and then even like, and then be able to align it as well, you know. It's like we can download subtitles from somewhere and align it to the thing, and I know they have services like that, iSubtitle, you know, DownSub, no, uh, yeah, Subscene.com. Like, what even is this, you know? What if they have an API, for example? I don't see the original Lion King, which is a little bit unfortunate. Yeah, so I do see some—even this website, Subscene.com, you know, I see a bunch of Arabic subtitles you could just download. And I don't think they have an API, but I didn't check. But this is like two seconds of work, you know, just like two seconds of work. 

Going through and just... And by the way, maybe the best thing isn't necessarily to download every movie that exists and have them in a DB. Right? But, I mean, why not? If you can, then why not? I don't even know how we would do that, but how would we do it? And is it legal? There shouldn't be any reason it's not legal. 

Yeah, so it's so interesting. They have all of these different subtitles on this. They look like they're in kind of a torrent format. They're not torrents. You can just download them, but they look like they're titled kind of torrent-like. So interesting. 

Cool. Yeah, so just go through everything. It's like, this is this, this is this, this is this, you know, categorize all this stuff, look up different resources. These are all the resources that are available. These are like the differences between the resources. This is like what we probably recommend. And then even further, you know, because there's some things like, hey, by the way, we're talking about training, we're talking about different models. Yeah, fuck it, like, we have this set up with these three options. Or set up these 10 options. He can fine-tune all of these. We can find scripts for fine-tuning all of these. And if you want, press a button, fine-tune it on this, and then try it, and then fine-tune it on this, and then try it. 

You have all these options to fine-tune or to create a model and talk to it, and then in these local options, and then you have even the online options to play around with. Of course, if you want to use a local model for inference or for generation, that's how you could do it. 

We have LM Studio, we have Olama as well, and all these people provide different things. Olama is the GOAT—they have a bunch of models over there. But there's also LM Studio.

So yeah, just going through all those. These are the options. And just a real quick thing, try to succinctly go through it all, but read through the instructions fully first. Then we can go through—basically, just the application should be. The short story is, you should be able to take a movie, generate a voice from any character in that movie, and use it directly in an AI assistant or an AI conversationalist. You should be able to do that easily.
Level two of this would be to listen to your system audio while you're playing a movie on a platform. So, even if you can't download the movie, you could still have the system listening to the audio and make it work, and then taking that in and basically from that transcribe it. Obviously, recording the audio is possible, and while you probably can't record the actual screen, maybe you can to an extent. I'm not sure how you would do it—you'd probably have to use a native API or something like that. 
And it would have to be—I don't know how you'd do it—it would be like screenshots. I'm not sure how you'd do it. I'll include the Hammerspoon docs as well. It's like a crazy project, but you'd have to use something where you're able to pull the visual—or not rip it—but pull the visual. 
And then be able to edit that or, you know, if that's too hard, then of course audio is not hard. I won't say it's not hard, but I will say I know that you can do it. So pull the audio at least, and if you can't pull the video, and then again, use that. So that would be like another level where I would say like, yeah, if you have, obviously everybody has access to the video so that you can watch on the internet. So you can take that, yeah, take that, create the voices and then use it. That's the idea for the application. I included a lot of resources, so go through all of them. Of course, Hammerspoon's an option, but there's obviously many other options as well for like scripting or doing something native and like pulling from API something. I'm sure you can actually use actual Apple stuff as well. I just think Hammerspoon probably may be an easier way to do it than actually getting into Xcode, but maybe we can get into Xcode as well. So anyway, get to work. 

https://github.com/Aveek-Saha/Movie-Script-Database/blob/master/README.md
https://github.com/smlum/scription

maybe ai vid editors and other maybe useful open source
https://github.com/bugbakery/audapolis
https://github.com/WyattBlue/auto-editor
https://github.com/elevenlabs/elevenlabs-examples
https://github.com/elevenlabs/elevenlabs-python
https://github.com/playht/pyht
https://github.com/descriptinc/descript-audio-codec
https://github.com/aregrid/frame
https://github.com/Zulko/moviepy
https://github.com/m-bain/whisperX
https://github.com/ggml-org/whisper.cpp
https://github.com/SYSTRAN/faster-whisper
https://github.com/kaldi-asr/kaldi
https://github.com/MontrealCorpusTools/Montreal-Forced-Aligner
https://github.com/MontrealCorpusTools/mfa-models
https://colab.research.google.com/github/unslothai/notebooks/blob/main/nb/Orpheus_(3B)-TTS.ipynb
https://docs.unsloth.ai/basics/text-to-speech-tts-fine-tuning
https://colab.research.google.com/github/unslothai/notebooks/blob/main/nb/Whisper.ipynb
https://huggingface.co/unsloth/orpheus-3b-0.1-ft-unsloth-bnb-4bit
https://huggingface.co/unsloth/orpheus-3b-0.1-pretrained-unsloth-bnb-4bit
https://github.com/TrelisResearch/ADVANCED-transcription/tree/main/text-to-speech
https://github.com/SesameAILabs/csm
https://huggingface.co/docs/transformers/main/en/model_doc/csm
https://colab.research.google.com/github/unslothai/notebooks/blob/main/nb/Sesame_CSM_(1B)-TTS.ipynb
https://sub-scene.com/

https://docs.unsloth.ai/get-started/all-our-models

https://stack.convex.dev/ai-agents
https://stack.convex.dev/durable-workflows-and-strong-guarantees
https://stack.convex.dev/author/ian-macartney
https://github.com/a16z-infra/ai-town
https://github.com/a16z-infra/companion-app
https://github.com/get-convex/agent
https://github.com/disler/always-on-ai-assistant
https://github.com/ollama/ollama
https://github.com/lmstudio-ai/lms

https://www.hammerspoon.org/docs/index.html