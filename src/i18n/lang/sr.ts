import type { UIStrings } from "../types";

export default {
  meta: {
    homeTitle: "Netlab Journal – containerlab labovi iz mrežnog inženjerstva",
    description:
      "Dnevnik učenja full-stack developera koji prelazi u mrežno inženjerstvo: containerlab labovi sa Nokia SR Linux, VyOS i drugim mrežnim OS-ovima.",
  },
  language: {
    label: "Jezik",
    fallbackNotice:
      "Ova stranica još nije prevedena na odabrani jezik, zato je prikazan original.",
  },
  nav: {
    home: "Početna",
    posts: "Postovi",
    tags: "Tagovi",
    about: "O meni",
    archives: "Arhiva",
    search: "Pretraga",
  },
  post: {
    publishedAt: "Objavljeno",
    updatedAt: "Ažurirano",
    sharePostIntro: "Podijeli ovaj post:",
    sharePostOn: "Podijeli ovaj post na {{platform}}",
    sharePostViaEmail: "Podijeli ovaj post putem e-maila",
    tagLabel: "Tagovi",
    backToTop: "Nazad na vrh",
    goBack: "Nazad",
    editPage: "Izmijeni stranicu",
    previousPost: "Prethodni post",
    nextPost: "Sljedeći post",
  },
  pagination: {
    prev: "Prethodna",
    next: "Sljedeća",
    page: "Stranica",
  },
  home: {
    socialLinks: "Društvene mreže",
    featured: "Izdvojeno",
    recentPosts: "Nedavni postovi",
    allPosts: "Svi postovi",
    heroTitle: "Od web developmenta do mrežnog inženjerstva:",
    heroIntro:
      "Ovdje bilježim kako iz full-stack web developmenta ulazim u mrežno inženjerstvo i security. Svaki post je jedan containerlab lab, hronološki, sa greškama i debug-om koje sam usput našao.",
    heroAboutBefore: "Pročitaj postove ispod, ili baci pogled na",
    heroAboutLink: "O meni",
    heroAboutAfter: "za sve informacije koje te zanimaju.",
  },
  footer: {
    copyright: "Autorska prava",
    allRightsReserved: "Sva prava zadržana.",
  },
  pages: {
    tagTitle: "Tag",
    tagDesc: "Svi članci sa tagom",

    tagsTitle: "Tagovi",
    tagsDesc: "Svi tagovi korišteni u postovima.",

    postsTitle: "Postovi",
    postsDesc: "Svi članci koje sam objavio.",

    archivesTitle: "Arhiva",
    archivesDesc: "Svi arhivirani članci.",

    searchTitle: "Pretraga",
    searchDesc: "Pretraži članke ...",
  },
  a11y: {
    skipToContent: "Preskoči na sadržaj",
    openMenu: "Otvori meni",
    closeMenu: "Zatvori meni",
    toggleTheme: "Promijeni temu",
    searchPlaceholder: "Pretraži postove...",
    noResults: "Nema rezultata",
    goToPreviousPage: "Idi na prethodnu stranicu",
    goToNextPage: "Idi na sljedeću stranicu",
  },
  notFound: {
    title: "404 Nije pronađeno",
    message: "Stranica nije pronađena",
    goHome: "Nazad na početnu",
  },
} satisfies UIStrings;
