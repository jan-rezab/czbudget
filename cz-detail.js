const entityJump = document.querySelector("#entity-jump");
if (entityJump) {
  entityJump.addEventListener("change", (event) => {
    window.location.assign(event.target.value);
  });
}
