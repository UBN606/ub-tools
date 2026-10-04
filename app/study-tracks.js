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
]

export function trackById(id) {
  return TRACKS.find((t) => t.id === id) || null
}
