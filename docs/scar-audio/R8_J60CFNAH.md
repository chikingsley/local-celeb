# Basic model info

Model name: minimax/voice-cloning
Model description: Clone voices to use with Minimax's speech-02-hd and speech-02-turbo

## Model inputs

- voice_file: Voice file to clone. Must be MP3, M4A, or WAV format, 10s to 5min duration, and less than 20MB. (string)
- need_noise_reduction: Enable noise reduction. Use this if the voice file has background noise. (boolean)
- model: The text-to-speech model to train (string)
- accuracy: Text validation accuracy threshold (0-1) (number)
- need_volume_normalization: Enable volume normalization (boolean)

## Model output schema

{
  "type": "object",
  "title": "VoiceCloningOutputs",
  "required": [
    "voice_id",
    "preview",
    "model"
  ],
  "properties": {
    "model": {
      "type": "string",
      "title": "Model"
    },
    "preview": {
      "type": "string",
      "title": "Preview",
      "format": "uri"
    },
    "voice_id": {
      "type": "string",
      "title": "Voice Id"
    }
  }
}

If the input or output schema includes a format of URI, it is referring to a file.

## Example inputs and outputs

Use these example outputs to better understand the types of inputs the model accepts, and the types of outputs the model returns:

### Example (<https://replicate.com/p/m4cr30a4csrm80cpmnqr4rqdew>)

#### Input

```json
{
  "model": "speech-02-turbo",
  "accuracy": 0.7,
  "voice_file": "https://replicate.delivery/czjl/21U5IFboRwrhBlKks9pmaz119Hvo1ISryE0LNUKuerpqS9UKA/output.wav",
  "need_noise_reduction": false,
  "need_volume_normalization": false
}
```

#### Output

```json
{
  "model": "speech-02-turbo",
  "preview": "https://replicate.delivery/xezq/p80hlWW4YWptBh3YGnNEDmR8ldh9QQDCxZNrICRge2HgT9UKA/tmpuo0ipa91.mp3",
  "voice_id": "R8_FDU1SV5S"
}
```

## Model readme

> ## Text-to-speech voice cloning
>
> Clone voices to use with Minimax's [speech-02-hd](https://replicate.com/minimax/speech-02-hd) and [speech-02-turbo](https://replicate.com/minimax/speech-02-turbo) models.
>
> Training is fast, and needs only 5s of audio. The more audio you give, the better the training accuracy.
>
> ## Privacy policy
>
> Data from this model is sent from Replicate to MiniMax.
>
> Check their Privacy Policy for details:
>
> <https://intl.minimaxi.com/protocol/privacy-policy>
>
> ## Terms of Service
>
> <https://intl.minimaxi.com/protocol/terms-of-service>
