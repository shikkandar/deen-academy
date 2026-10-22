// Package masjidscan reads a photo of a masjid's prayer timing board and returns the
// Azan and Jamaat (Iqamah) time for each prayer, using Claude's vision.
package masjidscan

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/shared/constant"
)

const model = "claude-opus-5-5"

// Claude accepts images up to 5 MB.
const MaxImageBytes = 5 << 20

var ErrUnreadable = errors.New("could not read prayer times from this photo")

// Times for one prayer as 24-hour "HH:MM", or nil when the board doesn't show it.
type PrayerTimes struct {
	Azan   *string `json:"azan"`
	Jamaat *string `json:"jamaat"`
}

type Result struct {
	MasjidName *string     `json:"masjidName"`
	Fajr       PrayerTimes `json:"fajr"`
	Dhuhr      PrayerTimes `json:"dhuhr"`
	Asr        PrayerTimes `json:"asr"`
	Maghrib    PrayerTimes `json:"maghrib"`
	Isha       PrayerTimes `json:"isha"`
	Jummah     PrayerTimes `json:"jummah"`
	// True when the photo clearly is a prayer timing board and at least one time was read.
	Readable bool `json:"readable"`
	// Anything the user should double-check (e.g. "Asr is partly hidden").
	Notes *string `json:"notes"`
}

var nullableTime = map[string]any{
	"anyOf": []any{
		map[string]any{"type": "string", "description": "24-hour time HH:MM"},
		map[string]any{"type": "null"},
	},
}

var prayerSchema = map[string]any{
	"type":                 "object",
	"properties":           map[string]any{"azan": nullableTime, "jamaat": nullableTime},
	"required":             []string{"azan", "jamaat"},
	"additionalProperties": false,
}

var nullableString = map[string]any{"anyOf": []any{map[string]any{"type": "string"}, map[string]any{"type": "null"}}}

var resultSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"masjidName": nullableString,
		"fajr":       prayerSchema,
		"dhuhr":      prayerSchema,
		"asr":        prayerSchema,
		"maghrib":    prayerSchema,
		"isha":       prayerSchema,
		"jummah":     prayerSchema,
		"readable":   map[string]any{"type": "boolean"},
		"notes":      nullableString,
	},
	"required":             []string{"masjidName", "fajr", "dhuhr", "asr", "maghrib", "isha", "jummah", "readable", "notes"},
	"additionalProperties": false,
}

const prompt = `This is a photo of a masjid's prayer timing board, most likely from Tamil Nadu, India.
Labels may be in English, Arabic, Urdu, or Tamil script (Tamil names include Subuh for Fajr, Luhar for Dhuhr,
Asar, Magrib, Isha and Jumma).

For each prayer, read the Azan (Adhan, "Bang", Tamil "Baangu") time and the Jamaat (Iqamah, "Jamath", Tamil
"Iqamath") time. Boards often show only one column — if there is one time per prayer and the board does not say
which, treat it as the Jamaat time.

Return every time in 24-hour HH:MM. Boards usually omit AM/PM: Fajr is in the early morning, Dhuhr around midday
(12:00–14:00), Asr in the afternoon, Maghrib around sunset, Isha in the evening — convert accordingly.
Use null for anything you cannot read with confidence. Never guess or calculate a time that is not on the board.
Set readable=false if this is not a prayer timing board or nothing can be read. Use notes for anything the user
should double-check, in one short sentence.`

var hhmm = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

type Scanner struct {
	client anthropic.Client
}

// New uses ANTHROPIC_API_KEY (or another configured Anthropic credential) from the environment.
func New() *Scanner {
	return &Scanner{client: anthropic.NewClient()}
}

func (s *Scanner) Scan(ctx context.Context, image []byte, mediaType string) (*Result, error) {
	resp, err := s.client.Beta.Messages.New(ctx, anthropic.BetaMessageNewParams{
		Model:     model,
		MaxTokens: 16000,
		Betas:     []anthropic.AnthropicBeta{anthropic.AnthropicBetaServerSideFallback2026_07_01},
		// If a safety classifier ever declines, the API retries on Anthropic's recommended fallback model.
		Fallbacks: anthropic.BetaFallbacksParamUnion{OfDefault: constant.ValueOf[constant.Default]()},
		OutputConfig: anthropic.BetaOutputConfigParam{
			Effort: anthropic.BetaOutputConfigEffortMedium,
			Format: anthropic.BetaJSONOutputFormatParam{Schema: resultSchema},
		},
		Messages: []anthropic.BetaMessageParam{
			anthropic.NewBetaUserMessage(
				anthropic.NewBetaImageBlock(anthropic.BetaBase64ImageSourceParam{
					Data:      base64.StdEncoding.EncodeToString(image),
					MediaType: anthropic.BetaBase64ImageSourceMediaType(mediaType),
				}),
				anthropic.NewBetaTextBlock(prompt),
			),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("claude request: %w", err)
	}
	if resp.StopReason == anthropic.BetaStopReasonRefusal {
		return nil, ErrUnreadable
	}

	var text string
	for _, block := range resp.Content {
		if t, ok := block.AsAny().(anthropic.BetaTextBlock); ok {
			text += t.Text
		}
	}

	var out Result
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return nil, fmt.Errorf("parse claude output: %w", err)
	}
	for _, p := range []*PrayerTimes{&out.Fajr, &out.Dhuhr, &out.Asr, &out.Maghrib, &out.Isha, &out.Jummah} {
		p.Azan = validTime(p.Azan)
		p.Jamaat = validTime(p.Jamaat)
	}
	if !out.Readable {
		return nil, ErrUnreadable
	}
	return &out, nil
}

// Drop anything that isn't a valid 24-hour HH:MM so the app never schedules a bogus time.
func validTime(t *string) *string {
	if t == nil || !hhmm.MatchString(*t) {
		return nil
	}
	return t
}
