import json
import matplotlib.pyplot as plt
import matplotlib.image as mpimg


data = {"nodes":[
{"id":1,"name":"Livraisons","x":940,"y":545},
{"id":2,"name":"Nacelle","x":905,"y":575},
{"id":3,"name":"Chaufferie (CH.F.) 1","x":873,"y":618},
{"id":4,"name":"Local poubelles (L.POUB.)","x":915,"y":650},
{"id":5,"name":"Chaufferie (CH.F.) 2","x":850,"y":660},
{"id":6,"name":"Sanitaires haut 1","x":810,"y":715},
{"id":7,"name":"Sanitaires haut 2","x":838,"y":715},
{"id":8,"name":"Vestiaire 1","x":850,"y":735},
{"id":9,"name":"Vestiaire 2","x":858,"y":753},
{"id":10,"name":"Chaufferie (CH.F.) 3","x":872,"y":760},
{"id":11,"name":"Monte-charge haut (MC)","x":927,"y":790},
{"id":12,"name":"Monte-charge cuisine (MC)","x":877,"y":900},
{"id":13,"name":"Cuisines","x":897,"y":970},
{"id":14,"name":"Hotte","x":790,"y":1005},
{"id":15,"name":"Local AU 1","x":845,"y":1030},
{"id":16,"name":"Local AU 2","x":905,"y":1030},
{"id":17,"name":"Ascenseur 1 (ASC)","x":833,"y":1215},
{"id":18,"name":"Ascenseur 2 (ASC)","x":858,"y":1215},
{"id":19,"name":"Sanitaires bas","x":890,"y":1280},
{"id":20,"name":"Local technique (L.T.)","x":420,"y":930},
{"id":21,"name":"Sanitaires gauche 1","x":278,"y":1090},
{"id":22,"name":"Sanitaires gauche 2","x":278,"y":1118},
{"id":23,"name":"Cafeteria","x":280,"y":1240},
{"id":24,"name":"Local déchets","x":183,"y":1490},
{"id":25,"name":"Monte-charge gauche (MC)","x":270,"y":1500},
{"id":26,"name":"Accueil","x":283,"y":1670},
{"id":27,"name":"Bureau 1 (près accueil)","x":420,"y":1650},
{"id":28,"name":"Bureau 2 (près accueil)","x":480,"y":1650},
{"id":29,"name":"Ascenseur 3 (près accueil)","x":430,"y":1600},
{"id":30,"name":"Ascenseur 4 (près accueil)","x":460,"y":1600},
{"id":31,"name":"Couloir haut (livraisons)","x":985,"y":600},
{"id":32,"name":"Couloir cuisine","x":950,"y":850},
{"id":33,"name":"Couloir central / jonction","x":700,"y":1180},
{"id":34,"name":"Couloir cafeteria","x":350,"y":1000},
{"id":35,"name":"Couloir accueil","x":330,"y":1550},
{"id":36,"name":"Couloir bas central","x":600,"y":1400}
],
"edges":[
{"source":31,"target":1},
{"source":31,"target":2},
{"source":31,"target":3},
{"source":31,"target":4},
{"source":31,"target":32},
{"source":32,"target":5},
{"source":32,"target":6},
{"source":32,"target":7},
{"source":32,"target":8},
{"source":32,"target":9},
{"source":32,"target":10},
{"source":32,"target":11},
{"source":32,"target":12},
{"source":32,"target":13},
{"source":32,"target":14},
{"source":32,"target":15},
{"source":32,"target":16},
{"source":32,"target":17},
{"source":32,"target":18},
{"source":32,"target":19},
{"source":32,"target":33},
{"source":33,"target":34},
{"source":33,"target":36},
{"source":34,"target":20},
{"source":34,"target":21},
{"source":34,"target":22},
{"source":34,"target":23},
{"source":34,"target":35},
{"source":35,"target":24},
{"source":35,"target":25},
{"source":35,"target":26},
{"source":35,"target":27},
{"source":35,"target":28},
{"source":35,"target":29},
{"source":35,"target":30},
{"source":36,"target":33},
{"source":36,"target":26}
]}
data = {
  "nodes": [
    {"id":1,"name":"Accueil","x":351,"y":1620},
    {"id":2,"name":"Cafétéria","x":323,"y":1175},
    {"id":3,"name":"Local déchets","x":177,"y":1390},
    {"id":4,"name":"Monte-charge (bas gauche)","x":254,"y":1360},
    {"id":5,"name":"Local technique (L.T.)","x":323,"y":900},
    {"id":6,"name":"Sanitaires gauche 1","x":269,"y":970},
    {"id":7,"name":"Sanitaires gauche 2","x":307,"y":970},
    {"id":8,"name":"Escalier CS (3,7,8,25)","x":576,"y":1025},
    {"id":9,"name":"Escalier CS (4,5,6,11)","x":660,"y":1085},
    {"id":10,"name":"Couloir central (vous êtes ici)","x":400,"y":1100},
    {"id":11,"name":"Rond-point de circulation","x":700,"y":1160},
    {"id":12,"name":"Ascenseur 1 (haut)","x":699,"y":1115},
    {"id":13,"name":"Ascenseur 2 (haut)","x":730,"y":1115},
    {"id":14,"name":"Ascenseur 3 (bas)","x":837,"y":1225},
    {"id":15,"name":"Ascenseur 4 (bas)","x":868,"y":1225},
    {"id":16,"name":"Cuisines","x":899,"y":930},
    {"id":17,"name":"Hotte","x":783,"y":1000},
    {"id":18,"name":"Chambre froide 1","x":884,"y":620},
    {"id":19,"name":"Chambre froide 2","x":884,"y":685},
    {"id":20,"name":"Chambre froide 3","x":914,"y":755},
    {"id":21,"name":"Local poubelles","x":929,"y":650},
    {"id":22,"name":"Vestiaire 1","x":853,"y":755},
    {"id":23,"name":"Vestiaire 9","x":884,"y":785},
    {"id":24,"name":"Sanitaires haut 1","x":822,"y":725},
    {"id":25,"name":"Sanitaires haut 2","x":853,"y":725},
    {"id":26,"name":"Monte-charge (haut)","x":945,"y":785},
    {"id":27,"name":"Livraisons","x":953,"y":540},
    {"id":28,"name":"Nacelle","x":937,"y":580},
    {"id":29,"name":"Sanitaires (bas droit)","x":868,"y":1330},
    {"id":30,"name":"Couloir diagonal (aile droite)","x":900,"y":900},
    {"id":31,"name":"Couloir bas droit","x":790,"y":1290},
    {"id":32,"name":"Salle sans nom (accueil gauche)","x":150,"y":1610},
    {"id":33,"name":"Salle sans nom (accueil centre)","x":420,"y":1600},
    {"id":34,"name":"Local SSI","x":570,"y":1720},
    {"id":35,"name":"Salle sans nom (zone x5 AU)","x":620,"y":1440},
    {"id":36,"name":"Couloir accueil (rond-point bas)","x":300,"y":1700}
  ],
  "edges": [
    {"source":1,"target":36},
    {"source":36,"target":32},
    {"source":36,"target":33},
    {"source":36,"target":34},
    {"source":36,"target":2},
    {"source":2,"target":10},
    {"source":10,"target":5},
    {"source":5,"target":6},
    {"source":5,"target":7},
    {"source":10,"target":3},
    {"source":3,"target":4},
    {"source":10,"target":8},
    {"source":8,"target":11},
    {"source":11,"target":9},
    {"source":11,"target":12},
    {"source":11,"target":13},
    {"source":11,"target":30},
    {"source":30,"target":16},
    {"source":16,"target":17},
    {"source":16,"target":20},
    {"source":20,"target":23},
    {"source":23,"target":22},
    {"source":22,"target":24},
    {"source":24,"target":25},
    {"source":20,"target":26},
    {"source":26,"target":21},
    {"source":21,"target":19},
    {"source":19,"target":18},
    {"source":18,"target":28},
    {"source":28,"target":27},
    {"source":30,"target":14},
    {"source":14,"target":15},
    {"source":15,"target":29},
    {"source":15,"target":31},
    {"source":11,"target":35},
    {"source":35,"target":36}
  ]
}
data = {
  "nodes": [
    {"id": 1,  "name": "Escalier (haut, zone livraisons)", "x": 855, "y": 372},
    {"id": 2,  "name": "Livraisons", "x": 935, "y": 545},
    {"id": 3,  "name": "Nacelle", "x": 940, "y": 590},
    {"id": 4,  "name": "Chambre froide 1 (Ch.F.)", "x": 855, "y": 615},
    {"id": 5,  "name": "Chambre froide 2 (Ch.F.)", "x": 855, "y": 660},
    {"id": 6,  "name": "Local poubelles (L.Poub.)", "x": 935, "y": 655},
    {"id": 7,  "name": "Vestiaire 1", "x": 845, "y": 700},
    {"id": 8,  "name": "Sanitaire (zone livraisons)", "x": 800, "y": 700},
    {"id": 9,  "name": "Vestiaire 2 (Vest.3)", "x": 845, "y": 735},
    {"id": 10, "name": "Chambre froide 3 (Ch.F.)", "x": 935, "y": 720},
    {"id": 11, "name": "Monte-charge 1 (MC)", "x": 945, "y": 765},
    {"id": 12, "name": "Couloir aile haute", "x": 890, "y": 630},
    {"id": 13, "name": "Escalier (zone L.T. hachuré)", "x": 790, "y": 785},
    {"id": 14, "name": "Cuisines", "x": 930, "y": 985},
    {"id": 15, "name": "Local hotte", "x": 790, "y": 1010},
    {"id": 16, "name": "Monte-charge 2 (MC)", "x": 885, "y": 900},
    {"id": 17, "name": "Couloir cuisines", "x": 830, "y": 1020},
    {"id": 18, "name": "Local transformateur", "x": 700, "y": 1155},
    {"id": 19, "name": "Escalier (près ASC 1-2)", "x": 605, "y": 1140},
    {"id": 20, "name": "Ascenseur 1 (ASC)", "x": 700, "y": 1130},
    {"id": 21, "name": "Ascenseur 2 (ASC)", "x": 735, "y": 1130},
    {"id": 22, "name": "Couloir colonnes sèches 3/7/8/25", "x": 600, "y": 1060},
    {"id": 23, "name": "Couloir colonnes sèches 4/5/11", "x": 665, "y": 1150},
    {"id": 24, "name": "Couloir diagonal central", "x": 780, "y": 1200},
    {"id": 25, "name": "Ascenseur 3 (ASC)", "x": 835, "y": 1265},
    {"id": 26, "name": "Ascenseur 4 (ASC)", "x": 865, "y": 1265},
    {"id": 27, "name": "Sanitaire (près ASC 3-4)", "x": 860, "y": 1360},
    {"id": 28, "name": "Couloir aile basse droite", "x": 800, "y": 1420},
    {"id": 29, "name": "Local L.T.", "x": 300, "y": 930},
    {"id": 30, "name": "Sanitaire gauche 1", "x": 270, "y": 1035},
    {"id": 31, "name": "Sanitaire gauche 2", "x": 270, "y": 1075},
    {"id": 32, "name": "Escalier gauche (hachuré)", "x": 230, "y": 790},
    {"id": 33, "name": "Couloir gauche (repère 'Vous êtes ici')", "x": 350, "y": 1035},
    {"id": 34, "name": "Cafétéria", "x": 330, "y": 1200},
    {"id": 35, "name": "Couloir central bas (CS 2)", "x": 465, "y": 1300},
    {"id": 36, "name": "Escalier bas central (x5 AU)", "x": 610, "y": 1345},
    {"id": 37, "name": "Accueil", "x": 250, "y": 1495},
    {"id": 38, "name": "Local déchets", "x": 175, "y": 1400},
    {"id": 39, "name": "Monte-charge 3 (MC)", "x": 270, "y": 1420},
    {"id": 40, "name": "Couloir accueil", "x": 350, "y": 1500},
    {"id": 41, "name": "Salle sans nom 1 (bureau, aile accueil)", "x": 450, "y": 1450},
    {"id": 42, "name": "Salle sans nom 2 (bureau, aile accueil)", "x": 350, "y": 1420},
    {"id": 43, "name": "Salle sans nom 3 (près cafétéria)", "x": 250, "y": 1250}
  ],
  "edges": [
    {"source": 1,  "target": 12},
    {"source": 12, "target": 2},
    {"source": 12, "target": 3},
    {"source": 12, "target": 4},
    {"source": 4,  "target": 5},
    {"source": 12, "target": 6},
    {"source": 12, "target": 7},
    {"source": 7,  "target": 8},
    {"source": 7,  "target": 9},
    {"source": 12, "target": 10},
    {"source": 12, "target": 11},
    {"source": 12, "target": 13},
    {"source": 13, "target": 17},
    {"source": 17, "target": 14},
    {"source": 14, "target": 15},
    {"source": 17, "target": 16},
    {"source": 17, "target": 24},
    {"source": 24, "target": 19},
    {"source": 19, "target": 20},
    {"source": 20, "target": 21},
    {"source": 24, "target": 18},
    {"source": 24, "target": 23},
    {"source": 23, "target": 22},
    {"source": 22, "target": 33},
    {"source": 24, "target": 25},
    {"source": 25, "target": 26},
    {"source": 26, "target": 27},
    {"source": 24, "target": 28},
    {"source": 28, "target": 40},
    {"source": 33, "target": 29},
    {"source": 29, "target": 32},
    {"source": 33, "target": 30},
    {"source": 30, "target": 31},
    {"source": 33, "target": 34},
    {"source": 34, "target": 43},
    {"source": 33, "target": 35},
    {"source": 35, "target": 36},
    {"source": 35, "target": 40},
    {"source": 40, "target": 37},
    {"source": 40, "target": 38},
    {"source": 38, "target": 39},
    {"source": 40, "target": 41},
    {"source": 40, "target": 42}
  ]
}

# index des nodes par id
nodes = {n["id"]: n for n in data["nodes"]}

# --- charger l'image de fond ---
img = mpimg.imread("test.png")

fig, ax = plt.subplots()

# afficher l'image
ax.imshow(img)

# --- dessiner les liens ---
for e in data["edges"]:
    n1 = nodes[e["source"]]
    n2 = nodes[e["target"]]

    ax.plot(
        [n1["x"], n2["x"]],
        [n1["y"], n2["y"]],
        color="yellow",
        linewidth=2,
        alpha=0.8
    )

# --- dessiner les nodes ---
for n in data["nodes"]:
    x, y = n["x"], n["y"]

    # point
    ax.scatter(x, y, s=60, c="red")

    # cercle autour
    circle = plt.Circle((x, y), 25, fill=False, color="cyan", linewidth=2)
    ax.add_patch(circle)

    # label
    ax.text(x + 5, y + 5, str(n["id"]), color="white", fontsize=8)

# garder les bonnes proportions
ax.set_axis_off()
ax.set_aspect("equal")

plt.show()