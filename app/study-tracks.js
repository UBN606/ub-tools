// study-tracks.js — guided study tracks: plain-language Q&A for newcomers and
// themed tracks, built from the questions real readers actually ask.
// Pure data so it can be tested; rendering needs a DOM.
// Content rule: every answer is plain everyday language, every quote is
// verbatim from the book with its exact reference. Verified with ub-search.js,
// never from memory.
'use strict'

export const TRACKS = [
  {
    id: "newcomer-start",
    title: 'New here? Start here',
    intro: 'First time with The Urantia Book? These are the questions everyone asks first — answered in plain language, with the exact paragraphs each answer comes from.',
    questions: [
      {
        q: "What are the main points of the Urantia Book?",
        answer: "Three big things. One, there is a real, personal God who is a loving Father. Two, you live in a huge, orderly universe and you are on a long journey toward Him that does not end at death. Three, Jesus lived the clearest picture ever given of what God is like and how a human life can be lived.",
        quotes: [
          { ref: "1:0.1", text: "THE Universal Father is the God of all creation, the First Source and Center of all things and beings." },
          { ref: "1:0.3", text: "The will creatures of universe upon universe have embarked upon the long, long Paradise journey, the fascinating struggle of the eternal adventure of attaining God the Father." },
          { ref: "196:1.1", text: "The Master has ascended on high as a man, as well as God; he belongs to men; men belong to him." },
        ],
      },
      {
        q: "What happens after we die?",
        answer: "You wake up. Death is a doorway, not an ending. You continue on the first of seven mansion worlds, training schools where you pick up right where you left off here, and everything good you did in this life carries straight over into the next.",
        quotes: [
          { ref: "47:10.7", text: "Mortal death is a technique of escape from the material life in the flesh; and the mansonia experience of progressive life through seven worlds of corrective training and cultural education represents the introduction of mortal survivors to the morontia career, the transition life which intervenes between the evolutionary material existence and the higher spirit attainment of the ascenders of time who are destined to achieve the portals of eternity." },
          { ref: "103:5.7", text: "The pursuit of the ideal—the striving to be Godlike—is a continuous effort before death and after. The life after death is no different in the essentials than the mortal existence. Everything we do in this life which is good contributes directly to the enhancement of the future life." },
        ],
      },
      {
        q: "Is there a God?",
        answer: "Yes. The book says God is real, personal, and knowable, not a vague force. He is the Universal Father, the First Source and Center of everything, and He wants a relationship with you.",
        quotes: [
          { ref: "1:0.1", text: "THE Universal Father is the God of all creation, the First Source and Center of all things and beings." },
          { ref: "1:2.1", text: "God is primal reality in the spirit world; God is the source of truth in the mind spheres; God overshadows all throughout the material realms. To all created intelligences God is a personality, and to the universe of universes he is the First Source and Center of eternal reality." },
        ],
      },
      {
        q: "Do humans reincarnate?",
        answer: "No. The book calls reincarnation a false and deadening belief. You get one mortal life, and death moves you forward into the mansion worlds, never back into another body on earth.",
        quotes: [
          { ref: "94:2.3", text: "And of all the contaminating beliefs which could have become fastened upon what may have been an emerging monotheism, none was so stultifying as this belief in transmigration—the doctrine of the reincarnation of souls—which came from the Dravidian Deccan." },
          { ref: "47:10.7", text: "Mortal death is a technique of escape from the material life in the flesh; and the mansonia experience of progressive life through seven worlds of corrective training and cultural education represents the introduction of mortal survivors to the morontia career, the transition life which intervenes between the evolutionary material existence and the higher spirit attainment of the ascenders of time who are destined to achieve the portals of eternity." },
        ],
      },
      {
        q: "Will I go to hell?",
        answer: "There is no hell of eternal torment in this book. The idea of hells was invented long ago by frightened people trying to explain why the wicked seemed to prosper. Those who finally refuse the journey simply cease to exist.",
        quotes: [
          { ref: "89:2.4", text: "To those who believed that prosperity and righteousness went together, the apparent prosperity of the wicked occasioned so much worry that it was necessary to invent hells for the punishment of taboo violators; the numbers of these places of future punishment have varied from one to five." },
          { ref: "47:2.7", text: "When material life has run its course, if no choice has been made for the ascendant life, or if these children of time definitely decide against the Havona adventure, death automatically terminates their probationary careers. There is no adjudication of such cases; there is no resurrection from such a second death. They simply become as though they had not been." },
        ],
      },
      {
        q: "What is the Holy Spirit?",
        answer: "In the book's own terms, the Holy Spirit is the personal spirit presence of the Universe Mother Spirit, also called the Divine Minister or Creative Spirit, the co-creator of our local universe. She is poured out on everyone and works in your inner life, growing stronger as you follow her leadings.",
        quotes: [
          { ref: "34:4.7", text: "The Universe Mother Spirit acts as the universe focus and center of the Spirit of Truth as well as of her own personal influence, the Holy Spirit." },
          { ref: "34:5.5", text: "The Holy Spirit is partly independent of human attitude and partially conditioned by the decisions and co-operation of the will of man. Nevertheless, the ministry of the Holy Spirit becomes increasingly effective in the sanctification and spiritualization of the inner life of those mortals who the more fully obey the divine leadings." },
        ],
      },
      {
        q: "How old was Jesus when he died?",
        answer: "He was 36. He was born at noon on August 21, 7 BC, and he died on Friday, April 7, AD 30.",
        quotes: [
          { ref: "122:8.1", text: "All that night Mary was restless so that neither of them slept much. By the break of day the pangs of childbirth were well in evidence, and at noon, August 21, 7 B.C., with the help and kind ministrations of women fellow travelers, Mary was delivered of a male child." },
          { ref: "185:0.1", text: "SHORTLY after six o’clock on this Friday morning, April 7, A.D. 30, Jesus was brought before Pilate, the Roman procurator who governed Judea, Samaria, and Idumea under the immediate supervision of the legatus of Syria." },
        ],
      },
      {
        q: "How was the earth created? / How old is the Earth?",
        answer: "The book says our sun took shape about five billion years ago, and it reckons the history of our planet, Urantia, as beginning about one billion years ago, unfolding through five great eras. It describes a long, orderly evolution, not a sudden creation.",
        quotes: [
          { ref: "57:5.1", text: "*5,000,000,000* years ago your sun was a comparatively isolated blazing orb, having gathered to itself most of the near-by circulating matter of space, remnants of the recent upheaval which attended its own birth." },
          { ref: "59:0.1", text: "WE RECKON the history of Urantia as beginning about one billion years ago and extending through five major eras:" },
        ],
      },
      {
        q: "Tell me about the god in me (the indwelling spirit / Thought Adjuster)",
        answer: "The book calls it the Thought Adjuster. It says an actual fragment of God the Father lives in the mind of every normal, morally conscious person, working as a patient guide leading you inward and upward toward perfection. You do not have to look farther than your own inner life to find God.",
        quotes: [
          { ref: "5:0.1", text: "An actual fragment of the living God resides within the intellect of every normal-minded and morally conscious Urantia mortal. The indwelling Thought Adjusters are a part of the eternal Deity of the Paradise Father." },
          { ref: "110:1.2", text: "These heavenly helpers are dedicated to the stupendous task of guiding you safely inward and upward to the celestial haven of happiness." },
        ],
      },
      {
        q: "Why do mortals go through trials and tribulations?",
        answer: "God does not send suffering as punishment. The book says hardship comes from the accidents of time, the consequences of our own choices, and life on an unfinished world. Trials are not divine anger; they are the friction every growing soul pushes against.",
        quotes: [
          { ref: "148:5.3", text: "But of one thing you may be sure: The Father does not send affliction as an arbitrary punishment for wrongdoing. Man should not blame God for those afflictions which are the natural result of the life which he chooses to live; neither should man complain of those experiences which are a part of life as it is lived on this world." },
          { ref: "148:6.11", text: "The Father in heaven does not willingly afflict the children of men. Man suffers, first, from the accidents of time and the imperfections of the evil of an immature physical existence." },
        ],
      },
    ],
  },
  {
    id: "love-one-another",
    title: 'Love one another',
    intro: 'What the book teaches about loving each other — and about learning from one another\u2019s religion.',
    questions: [
      {
        q: "Why is it important to learn about one another / love one another?",
        answer: "Because Jesus made it the new commandment: love one another as he loved us. The book says that drawing close to people in understanding sympathy is how God's love becomes real in the world, and it is the one mark by which others will know his followers.",
        quotes: [
          { ref: "180:1.1", text: "And so I give you this new commandment: That you love one another even as I have loved you. And by this will all men know that you are my disciples if you thus love one another." },
          { ref: "191:5.3", text: "By so drawing close to your fellow men in understanding sympathy and with unselfish devotion, you will lead them into a saving knowledge of the Father’s love." },
        ],
      },
      {
        q: "What does the book say about learning about another person's religion?",
        answer: "The book says every religion contains truth, and it is arrogance for any group to claim theirs is the whole of it. Study other faiths to find the best in them instead of denouncing the worst in them. Jesus modeled it in Rome: he never attacked anyone's errors, he found the truth in what they believed and built on it.",
        quotes: [
          { ref: "92:7.3", text: "There is not a Urantia religion that could not profitably study and assimilate the best of the truths contained in every other faith, for all contain truth. Religionists would do better to borrow the best in their neighbors’ living spiritual faith rather than to denounce the worst in their lingering superstitions and outworn rituals." },
          { ref: "132:0.4", text: "And this was his method of instruction: Never once did he attack their errors or even mention the flaws in their teachings. In each case he would select the truth in what they taught and then proceed so to embellish and illuminate this truth in their minds that in a very short time this enhancement of the truth effectively crowded out the associated error." },
        ],
      },
    ],
  },
{
    id: "what-happens-when-we-die",
    intro: "Death is the question readers ask about most. Here is what the book says happens after this life, in plain language, with the exact paragraphs each answer comes from.",
    questions: [
      {
        answer: "You sleep, and then you wake up on the first mansion world. Your guardian angel brings your soul, your Thought Adjuster brings your memories, and when the two reunite, your personality is reassembled and you are conscious again. You resume your life right where death interrupted it, in a new body.",
        q: "What happens right after we die?",
        quotes: [
          {
            ref: "47:3.1",
            text: "On the mansion worlds the resurrected mortal survivors resume their lives just where they left off when overtaken by death. When you go from Urantia to the first mansion world, you will notice considerable change, but if you had come from a more normal and progressive sphere of time, you would hardly notice the difference except for the fact that you were in possession of a different body; the tabernacle of flesh and blood has been left behind on the world of nativity."
          },
          {
            ref: "47:3.3",
            text: "The mortal-mind transcripts and the active creature-memory patterns as transformed from the material levels to the spiritual are the individual possession of the detached Thought Adjusters; these spiritized factors of mind, memory, and creature personality are forever a part of such Adjusters. The creature mind-matrix and the passive potentials of identity are present in the morontia soul intrusted to the keeping of the seraphic destiny guardians. And it is the reuniting of the morontia-soul trust of the seraphim and the spirit-mind trust of the Adjuster that reassembles creature personality and constitutes resurrection of a sleeping survivor."
          }
        ]
      },
      {
        answer: "No. The book describes a long, gradual journey, and death is only the doorway into its first stage: seven mansion worlds of training and growth. Reaching God comes much later, after a vast adventure through many worlds. Think of death as the first day of school, not graduation.",
        q: "Do we go straight to heaven?",
        quotes: [
          {
            ref: "47:10.7",
            text: "Mortal death is a technique of escape from the material life in the flesh; and the mansonia experience of progressive life through seven worlds of corrective training and cultural education represents the introduction of mortal survivors to the morontia career, the transition life which intervenes between the evolutionary material existence and the higher spirit attainment of the ascenders of time who are destined to achieve the portals of eternity."
          },
          {
            ref: "47:10.5",
            text: "Seven times do those mortals who pass through the entire mansonia career experience the adjustment sleep and the resurrection awakening. But the last resurrection hall, the final awakening chamber, was left behind on the seventh mansion world. No more will a form-change necessitate the lapse of consciousness or a break in the continuity of personal memory."
          }
        ]
      },
      {
        answer: "Yes. When you wake up on the first mansion world, you get ten days of personal freedom, and the book says you can spend that time looking up loved ones and earth friends who arrived before you. Friendly companions are also assigned to welcome every new arrival and stay with them on the journey.",
        q: "Will I see my loved ones again?",
        quotes: [
          {
            ref: "47:3.6",
            text: "From the resurrection halls you proceed to the Melchizedek sector, where you are assigned permanent residence. Then you enter upon ten days of personal liberty. You are free to explore the immediate vicinity of your new home and to familiarize yourself with the program which lies immediately ahead. You also have time to gratify your desire to consult the registry and call upon your loved ones and other earth friends who may have preceded you to these worlds. At the end of your ten-day period of leisure you begin the second step in the Paradise journey, for the mansion worlds are actual training spheres, not merely detention planets."
          },
          {
            ref: "48:3.8",
            text: "2. *Pilgrim Receivers and Free Associators.* These are the social companions of the new arrivals on the mansion worlds. One of them will certainly be on hand to welcome you when you awaken on the initial mansion world from the first transit sleep of time, when you experience the resurrection from the death of the flesh into the morontia life. And from the time you are thus formally welcomed on awakening to that day when you leave the local universe as a first-stage spirit, these Morontia Companions are ever with you."
          }
        ]
      },
      {
        answer: "Your soul is the part of you that grows during this life out of your choices, your character, and your reaching for God. When you die, your body returns to dust, but two nonmaterial things survive: your Thought Adjuster carries the record of your mind and memories, and your guardian angel keeps your soul. Their reunion on the mansion worlds is what wakes you up.",
        q: "What is the soul, and what part of me survives?",
        quotes: [
          {
            ref: "111:0.1",
            text: "THE presence of the divine Adjuster in the human mind makes it forever impossible for either science or philosophy to attain a satisfactory comprehension of the evolving soul of the human personality. The morontia soul is the child of the universe and may be really known only through cosmic insight and spiritual discovery."
          },
          {
            ref: "112:3.5",
            text: "After death the material body returns to the elemental world from which it was derived, but two nonmaterial factors of surviving personality persist: The pre-existent Thought Adjuster, with the memory transcription of the mortal career, proceeds to Divinington; and there also remains, in the custody of the destiny guardian, the immortal morontia soul of the deceased human. These phases and forms of soul, these once kinetic but now static formulas of identity, are essential to repersonalization on the morontia worlds; and it is the reunion of the Adjuster and the soul that reassembles the surviving personality, that reconsciousizes you at the time of the morontia awakening."
          },
          {
            ref: "111:3.7",
            text: "In so far as man’s evolving morontia soul becomes permeated by truth, beauty, and goodness as the value-realization of God-consciousness, such a resultant being becomes indestructible. If there is no survival of eternal values in the evolving soul of man, then mortal existence is without meaning, and life itself is a tragic illusion. But it is forever true: What you begin in time you will assuredly finish in eternity—if it is worth finishing."
          }
        ]
      },
      {
        answer: "Yes. Your Thought Adjuster keeps a complete transcript of your mind, so nothing you were is lost. The book says your personality remains intact from the moment you arrive on the first mansion world, and though you receive a new body at each step forward, there is never a break in who you are.",
        q: "Do I keep my memories and stay myself?",
        quotes: [
          {
            ref: "47:4.4",
            text: "A newly developed and suitably adjusted morontia body is acquired at the time of each advance from one mansion world to another. You go to sleep with the seraphic transport and awake with the new but undeveloped body in the resurrection halls, much as when you first arrived on mansion world number one except that the Thought Adjuster does not leave you during these transit sleeps between the mansion worlds. Your personality remains intact after you once pass from the evolutionary worlds to the initial mansion world."
          },
          {
            ref: "47:10.5",
            text: "Seven times do those mortals who pass through the entire mansonia career experience the adjustment sleep and the resurrection awakening. But the last resurrection hall, the final awakening chamber, was left behind on the seventh mansion world. No more will a form-change necessitate the lapse of consciousness or a break in the continuity of personal memory."
          }
        ]
      },
      {
        answer: "They are real, active training worlds, not clouds or waiting rooms. Each of the seven teaches you something new, corrects what this life left unfinished, and gives you a finer body as you grow. Finishing all seven is such a triumph that the whole capital world gathers to celebrate each graduating class.",
        q: "What are the mansion worlds like?",
        quotes: [
          {
            ref: "47:10.7",
            text: "Mortal death is a technique of escape from the material life in the flesh; and the mansonia experience of progressive life through seven worlds of corrective training and cultural education represents the introduction of mortal survivors to the morontia career, the transition life which intervenes between the evolutionary material existence and the higher spirit attainment of the ascenders of time who are destined to achieve the portals of eternity."
          },
          {
            ref: "47:10.1",
            text: "The reception of a new class of mansion world graduates is the signal for all Jerusem to assemble as a committee of welcome. Even the spornagia enjoy the arrival of these triumphant ascenders of evolutionary origin, those who have run the planetary race and finished the mansion world progression. Only the physical controllers and Morontia Power Supervisors are absent from these occasions of rejoicing."
          }
        ]
      }
    ],
    title: "What happens when we die?"
  },
]

export function trackById(id) {
  return TRACKS.find((t) => t.id === id) || null
}
